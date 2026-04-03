import { useEffect, useRef, useState } from 'react';
import './General_Home.css'
import { useNavigate } from 'react-router-dom';
import Core_gen from './core_general';

interface GeneralHomeProps {
  setTrigger?: (value: boolean) => void;
}

function General(props: GeneralHomeProps) {
  const section2Ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.6 }
    );

    if (section2Ref.current) {
      observer.observe(section2Ref.current);
    }

    return () => {
      if (section2Ref.current) {
        observer.unobserve(section2Ref.current);
      }
    };
  }, []);

  const navigate = useNavigate();

  const handleHome = () => {
        navigate('/');
        if (props.setTrigger) {
          props.setTrigger(false);
        }
    };

  
  return (
    <div className="container">
    <Core_gen></Core_gen>
        <div className='page'>
              <div className="home-1" onClick={handleHome}>
                        HOME
                </div>
              <div className="role-1">
                        ROLE
                </div>

            <div className="logo-g">         
                <div className="fextorflow-g" onClick={handleHome}>
                Fextorflow
                </div>           
            </div> 
            
        </div>
        

                
    </div>
  );
}

export default General;