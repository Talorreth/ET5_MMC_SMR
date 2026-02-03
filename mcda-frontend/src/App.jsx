import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import axios from 'axios'
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react'
import SimulationPanel from './components/SimulationPanel' // <--- C'est cet import qui fait le lien !

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

const SITES = [
  { id: 'indonesie', name: 'Indonésie (Kalimantan)', lat: -0.7893, lng: 113.9213 },
  { id: 'philippines', name: 'Philippines (Luzon)', lat: 12.8797, lng: 121.7740 },
  { id: 'barbade', name: 'Barbade', lat: 13.1939, lng: -59.5432 },
]

function App() {
  const [selectedIsland, setSelectedIsland] = useState(null)
  const [apiStatus, setApiStatus] = useState('loading')

  useEffect(() => {
    axios.get('http://127.0.0.1:8000/')
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'))
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100">
      {/* HEADER */}
      <header className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center z-30">
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

      <div className="flex-1 flex relative overflow-hidden">
        
        {/* CARTE */}
        <div className="flex-1 z-0 h-full">
          <MapContainer center={[10, 110]} zoom={3} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
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
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* PANNEAU LATÉRAL INTELLIGENT */}
        {selectedIsland && (
          <div className="absolute right-0 top-0 bottom-0 z-[1000] flex shadow-2xl animate-slide-in">
             {/* C'est ici qu'on appelle votre nouveau composant */}
             <SimulationPanel 
                island={selectedIsland} 
                onClose={() => setSelectedIsland(null)} 
             />
          </div>
        )}

      </div>
    </div>
  )
}

export default App