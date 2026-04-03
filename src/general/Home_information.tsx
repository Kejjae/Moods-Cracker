import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface HomeInfoProps {
  setTrigger?: (value: boolean) => void;
}
function Home_infor(props: HomeInfoProps) {

  const navigate = useNavigate();

  const handleClose = () => {
        navigate('/');
        if (props.setTrigger) {
          props.setTrigger(false);
        }
    };

  return (
    <div className="container-1">
      <div className='x_button' onClick={handleClose}>CLOSE</div>
        <div className="container-2">
            <div className='use-h'>
              <h2>{'FACIAL\nEXPRESSION\nRECOGNITION'}</h2>
              <p>{'is a computer vision task aimed at identifying and\ncategorizing emotional expressions depicted on a human face.\n The goal is to automate the process of determining emotions \nin real-time, by analyzing the various features of a face\n such as eyebrows, eyes, mouth, and other features, and\n mapping them to a set of emotions such as anger, fear, \nsurprise, sadness, happiness and neutral.'}</p>
            </div>
            
            <div className="role">
              <h3>Roles for you</h3>
            </div>
            
            <div className='role_types'>
              <div className='role_box1'>
                <h3>GENERAL USER</h3>
                <p>{'Users who want to explore or are\n interested in learning about facial\n expression recognition'}</p>
              </div>
              <div className='role_box2'>
                <h3>ADVANCED USER</h3>
                <p>{'Users who need comprehensive access to\n the system\'s capabilities for their\n specialized work in facial expression\n recognition'}</p>
              </div>
            </div>
        </div>
        </div>
  );
}

export default Home_infor;