import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import axios from 'axios'
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react'

// Hack pour les icônes Leaflet qui buggent parfois avec React/Webpack
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Coordonnées GPS des sites pilotes
const SITES = [
  { id: 'indonesie', name: 'Indonésie (Kalimantan)', lat: -0.7893, lng: 113.9213 },
  { id: 'philippines', name: 'Philippines (Luzon)', lat: 12.8797, lng: 121.7740 },
  { id: 'barbade', name: 'Barbade', lat: 13.1939, lng: -59.5432 },
]

function App() {
  const [selectedIsland, setSelectedIsland] = useState(null)
  const [apiStatus, setApiStatus] = useState('loading')

  // Test de connexion au démarrage
  useEffect(() => {
    axios.get('http://127.0.0.1:8000/')
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'))
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col">
      {/* HEADER */}
      <header className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center z-10">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Activity className="text-blue-400" />
          SMR Décision Multicritère
        </h1>
        <div className="text-sm flex items-center gap-2">
          API: 
          {apiStatus === 'online' ? (
            <span className="text-green-400 flex items-center gap-1"><CheckCircle size={14}/> Connectée</span>
          ) : (
            <span className="text-red-400 flex items-center gap-1"><AlertTriangle size={14}/> Déconnectée</span>
          )}
        </div>
      </header>

      {/* CONTENU PRINCIPAL */}
      <div className="flex-1 flex relative">
        
        {/* LA CARTE */}
        <div className="flex-1 z-0">
          <MapContainer center={[10, 110]} zoom={3} scrollWheelZoom={true}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {SITES.map((site) => (
              <Marker 
                key={site.id} 
                position={[site.lat, site.lng]}
                eventHandlers={{
                  click: () => setSelectedIsland(site),
                }}
              >
                <Popup>
                  <div className="text-center">
                    <h3 className="font-bold">{site.name}</h3>
                    <p className="text-xs text-gray-500">Cliquez pour analyser</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* PANNEAU LATÉRAL (DASHBOARD) - S'ouvre au clic */}
        {selectedIsland && (
          <div className="w-[500px] bg-white shadow-2xl z-10 p-6 overflow-y-auto border-l border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">{selectedIsland.name}</h2>
              <button 
                onClick={() => setSelectedIsland(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 mb-6">
              <p className="text-sm text-blue-800">
                L'analyse multicritère charge les données de vulnérabilité spécifiques à {selectedIsland.name}.
              </p>
            </div>

            <button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex justify-center items-center gap-2"
              onClick={() => alert("Nous connecterons le calcul à l'étape suivante !")}
            >
              <Activity size={18} />
              Lancer la simulation SMR
            </button>
            
            {/* Ici nous ajouterons les sliders et le classement */}
            <div className="mt-8 text-center text-gray-400 text-sm">
              Configuration en attente...
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default App