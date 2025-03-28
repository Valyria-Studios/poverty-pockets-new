import React from 'react';
import ArcGISMap from './components/ArcGISMap';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header" style={{ height: '60px', minHeight: 'unset', padding: '10px' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Census Data Explorer</h1>
      </header>
      <main style={{ height: 'calc(100vh - 60px)' }}>
        <ArcGISMap />
      </main>
    </div>
  );
}

export default App;