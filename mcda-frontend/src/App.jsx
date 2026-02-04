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
    <div className="h-screen w-screen flex flex-row relative overflow-hidden bg-slate-950">
      
      {/* CARTE - Occupe tout l'espace disponible */}
      <div className={`flex-1 transition-all duration-300 ease-out z-0 ${selectedIsland ? 'w-[calc(100%-700px)]' : 'w-full'}`}>
        <MapContainer 
          center={[15, 110]} 
          zoom={4} 
          zoomControl={false} 
          className="map-container"
          style={{ height: "100%", width: "100%" }}
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
      
      {/* HEADER FLOTTANT */}
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-md shadow-2xl rounded-xl p-4 border border-cyan-500/20 flex items-center gap-4 pointer-events-auto min-w-[300px] hover:border-cyan-500/40 transition-all duration-300">
          <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-3 rounded-lg text-white shadow-lg shadow-cyan-500/30 flex-shrink-0">
            <Zap size={24} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">SMR Decision Tool</h1>
            <p className="text-xs text-cyan-300/80 font-semibold tracking-widest uppercase">Analyse Multicritère</p>
          </div>
        </div>

        <div className={`pointer-events-auto self-start px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md flex items-center gap-2 shadow-lg transition-all duration-300 ${
           apiStatus === 'online' 
           ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30' 
           : 'bg-red-500/20 border-red-400/40 text-red-300 hover:bg-red-500/30'
        }`}>
           <div className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400 animate-bounce'}`}></div>
           {apiStatus === 'online' ? 'Moteur IA Connecté' : 'Serveur Déconnecté'}
        </div>
      </div>
      
      {/* PANNEAU LATÉRAL - Coulisse depuis la droite */}
      {selectedIsland && (
        <div className={`w-[700px] z-50 shadow-2xl flex flex-col bg-slate-900 overflow-hidden transition-all duration-300 border-l border-cyan-500/20 ${selectedIsland ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
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