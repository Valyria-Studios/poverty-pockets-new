import React from 'react';
import ArcGISMap from './components/ArcGISMap';
import './App.css';

function App() {
  return (
    <div className="App">
      <main style={{ height: '100vh' }}>
        <ArcGISMap />
      </main>
    </div>
  );
}

export default App;