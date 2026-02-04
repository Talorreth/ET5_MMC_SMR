import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import axios from 'axios'
import { Zap } from 'lucide-react'
import SimulationPanel from './components/SimulationPanel'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

// Configuration des marqueurs Leaflet
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
})
L.Marker.prototype.options.icon = DefaultIcon

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

  const statusLabel = apiStatus === 'online'
    ? 'API connectée'
    : apiStatus === 'offline'
      ? 'API hors-ligne'
      : 'Vérification API'

  return (
    <div className="app-shell">
      <div className="map-shell">
        <div className="map-overlay">
          <div className="brand-chip">
            <div className="brand-icon">
              <Zap size={14} />
            </div>
            <div className="brand-text">
              <span className="brand-title">MCDA SMR</span>
              <span className="brand-sub">Décision multi-critère insulaire</span>
            </div>
          </div>
          <div className={`status-chip status-${apiStatus}`}>
            <span className="status-dot" />
            <span>{statusLabel}</span>
          </div>
          {selectedIsland && (
            <div className="selection-chip">
              <span className="selection-dot" />
              <span>{selectedIsland.name}</span>
            </div>
          )}
        </div>

        <MapContainer 
          center={[15, 110]} 
          zoom={4} 
          zoomControl={false} 
          className="map-container"
          style={{ height: "100%", width: "100%" }}
        >
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
      
      {selectedIsland && (
        <div className="panel-shell">
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
