import os
import base64
import pickle
import numpy as np
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import face_recognition
import cv2

app = Flask(__name__)
CORS(app)

KNOWN_FACES_DIR = "known_faces"
FACES_DB_FILE = "faces_database.pkl"
os.makedirs(KNOWN_FACES_DIR, exist_ok=True)

known_face_encodings = []
known_face_names = []
known_face_paths = []

def load_known_faces():
    global known_face_encodings, known_face_names, known_face_paths
    if os.path.exists(FACES_DB_FILE):
        with open(FACES_DB_FILE, 'rb') as f:
            data = pickle.load(f)
            known_face_encodings = data.get('encodings', [])
            known_face_names = data.get('names', [])
            known_face_paths = data.get('paths', [])
        print(f"✅ Cargados {len(known_face_names)} rostros")

def save_known_faces():
    data = {
        'encodings': known_face_encodings,
        'names': known_face_names,
        'paths': known_face_paths
    }
    with open(FACES_DB_FILE, 'wb') as f:
        pickle.dump(data, f)
    print(f"💾 Guardados {len(known_face_names)} rostros")

load_known_faces()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'online',
        'faces_in_db': len(known_face_names)
    })

@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.json
        name = data.get('name')
        image_b64 = data.get('image')
        
        if not name or not image_b64:
            return jsonify({'error': 'Faltan datos'}), 400
        
        if ',' in image_b64:
            image_b64 = image_b64.split(',')[1]
        
        image_bytes = base64.b64decode(image_b64)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        face_locations = face_recognition.face_locations(rgb_img)
        if len(face_locations) == 0:
            return jsonify({'error': 'No se detectó rostro'}), 400
        
        face_encoding = face_recognition.face_encodings(rgb_img, face_locations)[0]
        
        known_face_encodings.append(face_encoding)
        known_face_names.append(name)
        
        # Guardar imagen con nombre único
        img_path = os.path.join(KNOWN_FACES_DIR, f"{name}_{len(known_face_names)}.jpg")
        cv2.imwrite(img_path, img)
        known_face_paths.append(img_path)
        
        save_known_faces()
        
        return jsonify({'success': True, 'message': f'{name} registrado'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/recognize', methods=['POST'])
def recognize():
    try:
        data = request.json
        image_b64 = data.get('image')
        
        if not image_b64:
            return jsonify({'error': 'No image'}), 400
        
        if ',' in image_b64:
            image_b64 = image_b64.split(',')[1]
        
        image_bytes = base64.b64decode(image_b64)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        face_locations = face_recognition.face_locations(rgb_img)
        if len(face_locations) == 0:
            return jsonify({'error': 'No se detectó rostro'}), 400
        
        face_encoding = face_recognition.face_encodings(rgb_img, face_locations)[0]
        
        if len(known_face_encodings) == 0:
            return jsonify({
                'success': True,
                'identified': False,
                'name': None,
                'confidence': 0,
                'image_filename': None,
                'message': 'No hay rostros'
            })
        
        # Calcular distancias
        distances = face_recognition.face_distance(known_face_encodings, face_encoding)
        best_match_index = np.argmin(distances)
        best_distance = distances[best_match_index]
        confidence = (1 - best_distance) * 100
        
        name = known_face_names[best_match_index]
        image_path = known_face_paths[best_match_index]
        image_filename = os.path.basename(image_path)
        
        identified = bool(best_distance < 0.6)
        
        return jsonify({
            'success': True,
            'identified': identified,
            'name': name,
            'confidence': round(confidence, 2),
            'image_filename': image_filename,
            'distance': round(float(best_distance), 4)
        })
        
    except Exception as e:
        print("ERROR:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/image/<filename>', methods=['GET'])
def get_image(filename):
    if not filename:
        return jsonify({'error': 'No filename'}), 400
    filepath = os.path.join(KNOWN_FACES_DIR, filename)
    if os.path.exists(filepath):
        return send_file(filepath, mimetype='image/jpeg')
    return jsonify({'error': 'Not found'}), 404

if __name__ == '__main__':
    print("="*50)
    print("🚀 SERVIDOR LISTO")
    print(f"📊 Rostros: {len(known_face_names)}")
    print("="*50)
    app.run(host='0.0.0.0', port=5000, debug=True)
