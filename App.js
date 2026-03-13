import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, Image, 
  Alert, StyleSheet, Modal, TextInput,
  ActivityIndicator, ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// CONFIGURACIÓN
// ============================================
const SERVER_URL = 'http://192.168.0.127:5000';  // Tu IP

export default function App() {
  const [foto, setFoto] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [permisoCamara, solicitarPermisoCamara] = useCameraPermissions();
  const [modoRegistro, setModoRegistro] = useState(false);
  const [nombreRegistro, setNombreRegistro] = useState('');
  const [mensaje, setMensaje] = useState('Iniciando...');
  const [serverStatus, setServerStatus] = useState('desconocido');
  const camaraRef = useRef(null);

  useEffect(() => {
    checkServer();
  }, []);

  const checkServer = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/health`);
      const data = await response.json();
      setServerStatus(`✅ Conectado (${data.faces_in_db} rostros)`);
      setMensaje(`Servidor listo - ${data.faces_in_db} rostros en BD`);
    } catch (error) {
      setServerStatus('❌ Servidor no disponible');
      setMensaje('Error: No se puede conectar al servidor');
      Alert.alert('Error de conexión', '¿El servidor está corriendo?');
    }
  };

  const tomarFoto = async () => {
    const { status } = await solicitarPermisoCamara();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado');
      return;
    }
    setResultado(null);
    setCamaraAbierta(true);
  };

  const capturarFoto = async () => {
    if (camaraRef.current) {
      setProcesando(true);
      try {
        const fotoTomada = await camaraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true
        });
        setCamaraAbierta(false);
        setFoto(fotoTomada.uri);
        
        if (modoRegistro) {
          await registrarRostro(fotoTomada.uri, fotoTomada.base64);
        } else {
          await identificarRostro(fotoTomada.uri, fotoTomada.base64);
        }
      } catch (error) {
        Alert.alert('Error', 'No se pudo capturar');
        setProcesando(false);
      }
    }
  };

  const seleccionarFoto = async () => {
    setProcesando(true);
    setResultado(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true
      });

      if (!result.canceled) {
        setFoto(result.assets[0].uri);
        
        if (modoRegistro) {
          await registrarRostro(result.assets[0].uri, result.assets[0].base64);
        } else {
          await identificarRostro(result.assets[0].uri, result.assets[0].base64);
        }
      } else {
        setProcesando(false);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo acceder');
      setProcesando(false);
    }
  };

  const registrarRostro = async (uri, base64) => {
    if (!nombreRegistro.trim()) {
      Alert.alert('Error', 'Ingresa un nombre');
      setProcesando(false);
      return;
    }

    try {
      setMensaje('Enviando al servidor...');
      
      const response = await fetch(`${SERVER_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nombreRegistro,
          image: `data:image/jpeg;base64,${base64}`
        })
      });

      const data = await response.json();
      
      if (data.success) {
        Alert.alert('✅ REGISTRADO', `${nombreRegistro}`);
        setNombreRegistro('');
        setModoRegistro(false);
        checkServer();
      } else {
        Alert.alert('Error', data.error || 'No se pudo registrar');
      }
      
    } catch (error) {
      Alert.alert('Error', 'No se pudo conectar al servidor');
    } finally {
      setProcesando(false);
    }
  };

  // 🔥 FUNCIÓN CORREGIDA - Maneja todos los casos
  const identificarRostro = async (uri, base64) => {
    try {
      setMensaje('Enviando al servidor...');
      
      const response = await fetch(`${SERVER_URL}/recognize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: `data:image/jpeg;base64,${base64}`
        })
      });

      const data = await response.json();
      
      if (data.success) {
        if (data.identified) {
          // ✅ CASO 1: Rostro identificado
          const imageUrl = `${SERVER_URL}/image/${data.image_filename}`;
          
          setResultado({
            nombre: data.name,
            confianza: data.confidence,
            imageUrl: imageUrl,
          });
          Alert.alert('✅ IDENTIFICADO', `${data.name} (${data.confidence}%)`);
        } else {
          // ✅ CASO 2: Rostro no identificado
          setResultado(null);
          
          if (data.message === 'No hay rostros registrados en la base de datos') {
            Alert.alert('ℹ️ Sin datos', 'Registra algunos rostros primero');
            setModoRegistro(true);
          } else {
            Alert.alert('❌ NO IDENTIFICADO', `Confianza: ${data.confidence}%`);
          }
        }
      } else {
        // ✅ CASO 3: Error del servidor
        Alert.alert('Error', data.error || 'Error en identificación');
      }
      
    } catch (error) {
      // ✅ CASO 4: Error de conexión
      Alert.alert('Error', 'No se pudo conectar al servidor');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>🔍 Face Recognition Pro</Text>
      <Text style={styles.mensaje}>{mensaje}</Text>
      <Text style={styles.serverStatus}>{serverStatus}</Text>
      
      <View style={styles.modoSelector}>
        <TouchableOpacity 
          style={[styles.modoBoton, !modoRegistro && styles.modoActivo]}
          onPress={() => setModoRegistro(false)}
        >
          <Text style={styles.modoTexto}>🔍 IDENTIFICAR</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.modoBoton, modoRegistro && styles.modoActivo]}
          onPress={() => setModoRegistro(true)}
        >
          <Text style={styles.modoTexto}>📸 REGISTRAR</Text>
        </TouchableOpacity>
      </View>

      {modoRegistro && (
        <TextInput
          style={styles.input}
          placeholder="Nombre de la persona"
          value={nombreRegistro}
          onChangeText={setNombreRegistro}
        />
      )}

      <View style={styles.botones}>
        <TouchableOpacity style={styles.boton} onPress={seleccionarFoto} disabled={procesando}>
          <Text style={styles.botonTexto}>📸 GALERÍA</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.boton, styles.botonCamara]} onPress={tomarFoto} disabled={procesando}>
          <Text style={styles.botonTexto}>📷 CÁMARA</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.botonRecargar} onPress={checkServer}>
        <Text style={styles.botonTexto}>🔄 RECARGAR</Text>
      </TouchableOpacity>

      {procesando && (
        <View style={styles.procesando}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.procesandoTexto}>Comunicando con servidor...</Text>
        </View>
      )}

      {foto && !procesando && (
        <>
          <Text style={styles.subtitulo}>📸 Foto buscada:</Text>
          <Image source={{ uri: foto }} style={styles.foto} />
        </>
      )}

      {resultado && !procesando && !modoRegistro && (
        <View style={styles.resultadoBox}>
          <Text style={styles.resultadoTitulo}>✅ IDENTIFICADO</Text>
          
          {resultado.imageUrl && (
            <Image 
              source={{ uri: resultado.imageUrl }} 
              style={styles.resultadoImagen} 
            />
          )}
          
          <Text style={styles.resultadoNombre}>{resultado.nombre}</Text>
          <Text style={styles.resultadoConfianza}>{resultado.confianza}% confianza</Text>
        </View>
      )}

      <Modal visible={camaraAbierta} animationType="slide">
        <View style={styles.camaraContainer}>
          <CameraView ref={camaraRef} style={styles.camara} facing="front">
            <View style={styles.controlesCamara}>
              <TouchableOpacity style={styles.botonCapturar} onPress={capturarFoto}>
                <View style={styles.botonCapturarInterno} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.botonCerrar} onPress={() => setCamaraAbierta(false)}>
                <Text style={styles.botonCerrarTexto}>✕</Text>
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#fff' },
  titulo: { fontSize: 22, textAlign: 'center', marginTop: 40, marginBottom: 5, fontWeight: 'bold' },
  mensaje: { textAlign: 'center', color: '#666', marginBottom: 5 },
  serverStatus: { textAlign: 'center', color: '#007AFF', marginBottom: 10, fontSize: 12 },
  
  modoSelector: { flexDirection: 'row', marginBottom: 10 },
  modoBoton: { flex: 1, padding: 12, backgroundColor: '#ddd', alignItems: 'center', marginHorizontal: 2, borderRadius: 8 },
  modoActivo: { backgroundColor: '#007AFF' },
  modoTexto: { color: '#fff', fontWeight: 'bold' },
  
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 10, backgroundColor: '#fff' },
  
  botones: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 5 },
  boton: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, flex: 0.45 },
  botonCamara: { backgroundColor: '#34C759' },
  botonRecargar: { backgroundColor: '#FF9500', padding: 10, borderRadius: 8, marginTop: 5 },
  botonTexto: { color: 'white', textAlign: 'center', fontSize: 13, fontWeight: 'bold' },
  
  procesando: { alignItems: 'center', marginVertical: 15 },
  procesandoTexto: { marginTop: 5, color: '#666' },
  
  subtitulo: { fontSize: 14, fontWeight: 'bold', marginBottom: 5, marginTop: 10 },
  foto: { width: '100%', height: 150, borderRadius: 8, marginBottom: 10 },
  
  resultadoBox: { 
    backgroundColor: '#e8f4fd', 
    padding: 15, 
    borderRadius: 10, 
    borderWidth: 2, 
    borderColor: '#007AFF', 
    marginTop: 10, 
    alignItems: 'center' 
  },
  resultadoTitulo: { fontSize: 14, fontWeight: 'bold', marginBottom: 5, color: '#007AFF' },
  
  resultadoImagen: { 
    width: 200, 
    height: 200, 
    borderRadius: 20, 
    marginVertical: 15,
    borderWidth: 3,
    borderColor: '#007AFF'
  },
  
  resultadoNombre: { fontSize: 18, fontWeight: 'bold' },
  resultadoConfianza: { fontSize: 16, color: '#007AFF', fontWeight: 'bold', marginTop: 5 },
  
  camaraContainer: { flex: 1, backgroundColor: '#000' },
  camara: { flex: 1 },
  controlesCamara: { 
    position: 'absolute', bottom: 30, left: 0, right: 0, alignItems: 'center' 
  },
  botonCapturar: { 
    width: 70, height: 70, borderRadius: 35, 
    backgroundColor: 'rgba(255,255,255,0.3)', 
    justifyContent: 'center', alignItems: 'center' 
  },
  botonCapturarInterno: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  botonCerrar: { 
    position: 'absolute', top: 40, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', alignItems: 'center' 
  },
  botonCerrarTexto: { color: '#fff', fontSize: 20, fontWeight: 'bold' }
});
