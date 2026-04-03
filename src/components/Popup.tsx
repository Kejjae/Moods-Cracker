import React from 'react';
import './Popup.css'
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PopupProps {
  trigger: boolean;
  setTrigger?: (value: boolean) => void;
  children?: React.ReactNode;
}

function Popup(props: PopupProps) {

  const navigate = useNavigate();

  const handleCoreGeneral = () => {
    navigate('/general/core_general');
    if (props.setTrigger) props.setTrigger(false);
  };

  const handleModel1 = () => {
    navigate('/advanced/Model_1');
    if (props.setTrigger) props.setTrigger(false);
  };

  if (!props.trigger) return null;

  return (
    <div className="popup">
      <div className="popup-inner">
        <div className="info-wrapper">
          <button className="exit" onClick={() => props.setTrigger?.(false)}>
            ✕
          </button>
          {props.children}
        </div>

        <div className="cards-row-popup">
          <div className='s3-h'>
            <h2>Basic User</h2>
            <div className='h-line'></div>
            <p>{'Users who want to explore or are interested in learning about facial expression recognition'}</p>
            <button className="g-button" onClick={handleCoreGeneral}>Explore More</button>
          </div>

          <div className='s2-h'>
            <h2>Advance User</h2>
            <div className='h2-line'></div>
            <p>{"Users who need comprehensive access to the system's capabilities for their specialized work in facial expression recognition"}</p>
            <button className="a-button" onClick={handleModel1}>Explore More</button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Popup;