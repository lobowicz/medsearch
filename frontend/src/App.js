import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import logo from './logo.svg';
import './App.css';

function App() {
  return (
    <div className="App">
      <nav style={{ padding: '1rem', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <Link to="/" style={{ marginRight: '1rem' }}>Home</Link>
        <Link to="/about">About</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </div>
  );
}

export default App;
