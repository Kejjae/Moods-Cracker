import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
import General from './general/General_Home';
import Core_gen from './general/core_general';
import Model1 from './advanced/Model_1';
import Compare from './advanced/Compare';
import ViewResult from './advanced/View_Result';
import Home_infor from './general/Home_information';
import Tech_Info from './advanced/TechInfo';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/general" element={<General />} />
        <Route path="/general/core_general" element={<Core_gen />} />
        <Route path="/general/Home_information" element={<Home_infor />} />
        <Route path="/advanced/Model_1" element={<Model1 />} />
        <Route path="/advanced/Compare" element={<Compare />} />
        <Route path="/advanced/View_Result" element={<ViewResult />} />
        <Route path="/advanced/TechInfo" element={<Tech_Info />} />
      </Routes>
    </Router>
  );
}

export default App;
