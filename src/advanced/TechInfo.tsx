import { useEffect, useRef, useState } from 'react';
import './Model.css'
import { useNavigate } from 'react-router-dom';
import Core_Ad from './core_advanced';

interface TechInfoProps {
  setTrigger?: (value: boolean) => void;
}

function Tech_Info(props: TechInfoProps) {

  const navigate = useNavigate();

  const handleHome = () => {
        navigate('/');
        if (props.setTrigger) {
          props.setTrigger(false);
        }
    };

  const handleExplore = () => {
    navigate('/advanced/Compare');
    if (props.setTrigger) {
      props.setTrigger(false);
    }
  };

  const handleBack = () => {
    navigate('/advanced/Model_1');
    if (props.setTrigger) {
      props.setTrigger(false);
    }
  };

  return (
    <div className="container-m">
        <div className='page-m'>  
          <div className="nav-item" onClick={handleHome}>Fextorflow</div>
          <div className="nav-general">
                <span className="nav-general-item" onClick={handleHome}>HOME</span>
                <span className="nav-general-item" onClick={handleBack}>MODEL</span>
                <span className="nav-general-item" onClick={handleExplore}>COMPARATIVE</span>
          </div> 
        </div> 
        <div className='m-name'>
          <p> Model 1 </p>
        </div>  
        <img src="/public/img/model-graph.png" className="m-graph" /> 
    </div>
   
  );
}

export default Tech_Info;