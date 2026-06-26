import sys
import os
import json
import base64
import traceback
os.environ["YOLO_VERBOSE"] = "False"
print("STARTING", flush=True)
try:
    import cv2
    from ultralytics import YOLO
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(script_dir, "rrp32.pt")
    model = YOLO(model_path)
    print("READY", flush=True)
except Exception as e:
    error_msg = {"error": f"Initialization failed: {str(e)}", "trace": traceback.format_exc()}
    print(json.dumps(error_msg), flush=True)
    sys.exit(1)
for line in sys.stdin:
    image_path = line.strip()
    if not image_path:
        continue
    if image_path == "EXIT":
        break
    try:
        if not os.path.exists(image_path):
            print(json.dumps({"error": f"Image file not found: {image_path}"}), flush=True)
            continue
        results = model(image_path)
        annotated_bgr = results[0].plot()
        success_encode, encoded_image = cv2.imencode('.jpg', annotated_bgr)
        if not success_encode:
            print(json.dumps({"error": "Failed to encode annotated image to JPEG"}), flush=True)
            continue
        base64_str = base64.b64encode(encoded_image).decode('utf-8')
        detections = []
        if results[0].boxes is not None:
            for box in results[0].boxes:
                cls_id = int(box.cls[0].item())
                label = model.names[cls_id]
                conf = float(box.conf[0].item())
                detections.append({
                    "class": label,
                    "confidence": conf
                })
        response = {
            "annotated_image": base64_str,
            "detections": detections
        }
        print(json.dumps(response), flush=True)
        
    except Exception as e:
        print(json.dumps({"error": f"Inference error: {str(e)}", "trace": traceback.format_exc()}), flush=True)
