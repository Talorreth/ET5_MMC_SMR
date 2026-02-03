import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import axios from 'axios'
import { Zap, Activity } from 'lucide-react'
import SimulationPanel from './components/SimulationPanel'
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Configuration des marqueurs Leaflet
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const SITES = [
  { id: 'indonesie', name: 'Indonésie (Kalimantan)', lat: -0.7893, lng: 113.9213 },
  { id: 'philippines', name: 'Philippines (Luzon)', lat: 12.8797, lng: 121.7740 },
  { id: 'barbade', name: 'Barbade', lat: 13.1939, lng: -59.5432 },
]

function App() {
  const [selectedIsland, setSelectedIsland] = useState(null)
  const [apiStatus, setApiStatus] = useState('checking')

  useEffect(() => {
    axios.get('http://127.0.0.1:8000/')
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'))
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden bg-slate-900">
      
      {/* HEADER FLOTTANT MODERNE */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-none">
        {/* Titre */}
        <div className="bg-white/95 backdrop-blur shadow-xl rounded-2xl p-4 border border-white/20 flex items-center gap-4 pointer-events-auto min-w-[300px]">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-xl text-white shadow-lg shadow-blue-500/30">
            <Zap size={24} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">SMR Decision Tool</h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Analyse Multicritère</p>
          </div>
        </div>

        {/* Statut API */}
        <div className={`pointer-events-auto self-start px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-sm flex items-center gap-2 shadow-sm ${
           apiStatus === 'online' 
           ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800' 
           : 'bg-red-500/10 border-red-500/20 text-red-800'
        }`}>
           <div className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
           {apiStatus === 'online' ? 'Connecté' : 'Serveur Déconnecté'}
        </div>
      </div>

      {/* CARTE PLEIN ÉCRAN */}
      <div className="absolute inset-0 z-0">
        <MapContainer 
          center={[15, 110]} 
          zoom={4} 
          zoomControl={false} // On cache le zoom par défaut pour le mettre ailleurs
          style={{ height: "100%", width: "100%", background: '#0f172a' }}
        >
          {/* Fond de carte "Voyager" (Plus propre que OpenStreetMap standard) */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <ZoomControl position="bottomright" />
          
          {SITES.map((site) => (
            <Marker 
              key={site.id} 
              position={[site.lat, site.lng]}
              eventHandlers={{
                click: () => setSelectedIsland(site),
              }}
            >
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* PANNEAU LATÉRAL (Slide Over) */}
      {selectedIsland && (
        <div className="absolute top-0 right-0 bottom-0 w-full md:w-[600px] lg:w-[700px] z-[1001] shadow-2xl animate-slide-in flex flex-col bg-white">
           <SimulationPanel 
              island={selectedIsland} 
              onClose={() => setSelectedIsland(null)} 
           />
        </div>
      )}
    </div>
  )
}

export default App