import { useNavigate } from 'react-router-dom';
import './AboutUs.css';

interface HomeInfoProps {
  setTrigger?: (value: boolean) => void;
}

function Home_infor(props: HomeInfoProps) {
  const navigate = useNavigate();

  const handleHome = () => {
    navigate('/');
    if (props.setTrigger) props.setTrigger(false);
  };

  return (
    <div className="container-about">
      <div className="about-topbar">
        <div className="about-topbar-left">
          <span className="dot-red" />
        </div>
        <div className="about-topbar-center">
          MOOD&nbsp;CRACKER
        </div>

        <div className="about-topbar-right">
          <span className="dot-red" />
          <div className="x_button" onClick={handleHome}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        </div>
      </div>

      <hr className="about-rule" />

      <div className="about-body">
        <div className="about-left">

          <h1 className="about-headline">
            What About Our MOOD CRAKer ?
          </h1>

          <p className="about-subtext">
            Mood Cracker is a web application that addresses practical limitations
            of existing FER systems — particularly with angled or partially occluded faces — by combining
            a fine-tuned Convolutional Neural Network (CNN) for deep facial feature extraction with
            Long Short-Term Memory (LSTM) for temporal sequence learning.
          </p>
          <p className="about-subtext">
            Our system covers six emotions (custom-trained):
            happiness, sadness, anger, fear, disgust, and surprise. And seven emotions including Neutral (from the original model). The platform supports image,
            video, and real-time webcam input with probability scores and temporal emotion timelines.
          </p>
        </div>

        <div className="about-right">
          <div className="about-right-title" >
            <h2>ROLES FOR YOU</h2>
          </div>

          <div className="about-card">
            <p className="about-card-title">General User</p>
            <p className="about-card-sub">Explore &amp; Learn</p>
            <p>
              {'Users who want to explore or are interested in learning about facial expression recognition'}
            </p>
          </div>

          <div className="about-card">
            <p className="about-card-title">Advanced User</p>
            <p className="about-card-sub">Deep Exploration &amp; Data access</p>
            <p>
              {"Users who need comprehensive access to the system's capabilities for their specialized work in facial expression recognition"}
            </p>
          </div>
        </div>

      </div>

      <div className="about-products">
        <h2 className="about-products-title">Our Features</h2>

        <div className="about-products-grid">

          <div className="about-product-card">
            <div className="about-product-card-topbar" />
            <div className="about-product-card-name">
              <span className="product-name-script">Image</span>
              <span className="product-name-bold">Input</span>
            </div>
            <div className="about-product-card-img">
              <svg viewBox="0 0 120 80" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="8" width="100" height="64" rx="3" fill="#b2e9ff" stroke="#222" strokeWidth="2"/>
                <polygon points="10,72 40,36 60,54 80,30 110,72" fill="#2d6130" stroke="#222" strokeWidth="1.5"/>
                <circle cx="85" cy="24" r="8" fill="#fcc485" stroke="#222" strokeWidth="1.5"/>
                <line x1="10" y1="8" x2="10" y2="72" stroke="#222" strokeWidth="2"/>
                <line x1="110" y1="8" x2="110" y2="72" stroke="#222" strokeWidth="2"/>
                <line x1="10" y1="8" x2="110" y2="8" stroke="#222" strokeWidth="2"/>
                <line x1="10" y1="72" x2="110" y2="72" stroke="#222" strokeWidth="2"/>
              </svg>
            </div>
            <p className="about-product-card-desc">
              Upload a static image and get instant emotion detection results.
            </p>
          </div>

          <div className="about-product-card">
            <div className="about-product-card-topbar" />
            <div className="about-product-card-name">
              <span className="product-name-script">Video</span>
              <span className="product-name-bold">Input</span>
            </div>
            <div className="about-product-card-img">
              <svg viewBox="0 0 120 80" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="12" width="72" height="56" rx="3" fill="#222222" stroke="#222" strokeWidth="2"/>
                <polygon points="112,40 88,26 88,54" fill="#222" stroke="#222" strokeWidth="1.5" strokeLinejoin="round"/>
                <line x1="88" y1="26" x2="88" y2="54" stroke="#222" strokeWidth="2"/>
                <rect x="16" y="20" width="56" height="40" rx="2" fill="#ff8f8f" stroke="#222" strokeWidth="1.2"/>
                <circle cx="44" cy="40" r="10" fill="none" stroke="#222" strokeWidth="1.8"/>
                <polygon points="41,35 41,45 51,40" fill="#222"/>
                <rect x="14" y="72" width="8" height="4" rx="1" fill="#222"/>
                <rect x="25" y="72" width="8" height="4" rx="1" fill="#222"/>
                <rect x="36" y="72" width="8" height="4" rx="1" fill="#222"/>
                <rect x="47" y="72" width="8" height="4" rx="1" fill="#222"/>
              </svg>
            </div>
            <p className="about-product-card-desc">
              Upload a video file and receive a full temporal emotion timeline — tracking expression throughout the entire clip.
            </p>
          </div>

          <div className="about-product-card">
            <div className="about-product-card-topbar" />
            <div className="about-product-card-name">
              <span className="product-name-script">Real-time</span>
              <span className="product-name-bold">Webcam</span>
            </div>
            <div className="about-product-card-img">
              <svg viewBox="0 0 120 80" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <rect x="20" y="8" width="80" height="52" rx="5" fill="#fff" stroke="#222" strokeWidth="2.5"/>
                <circle cx="60" cy="34" r="16" fill="#ccc" stroke="#222" strokeWidth="2"/>
                <circle cx="60" cy="34" r="8" fill="#ccc" stroke="#222" strokeWidth="1.5"/>
                <circle cx="60" cy="34" r="3" fill="#222"/>
                <rect x="50" y="60" width="20" height="5" rx="2" fill="#222"/>
                <rect x="30" y="65" width="60" height="4" rx="2" fill="#222"/>
                <circle cx="98" cy="14" r="4" fill="#c0392b"/>
                <circle cx="98" cy="14" r="2" fill="#ff6b6b"/>
              </svg>
            </div>
            <p className="about-product-card-desc">
              Live emotion detection via webcam with real-time probability bars and a temporal emotion timeline — supporting six and seven emotion classes continuously.
            </p>
          </div>

        </div>
      </div>

      <div className="about-products about-members">
        <h2 className="about-products-title">Our Members</h2>

        <div className="about-members-grid">

          <div className="about-member-card">
            <div className="about-product-card-topbar" />
            <div className="about-member-img">
              <img src="/img/k1.jpg" alt="Kew.thn" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <p className="about-member-name">Kewalee Thanachotchayanee</p>
            <p className="about-member-role">Email: 65070026@kmitl.ac.th</p>
          </div>

          <div className="about-member-card">
            <div className="about-product-card-topbar" />
            <div className="about-member-img">
              <img src="/img/IMG_3774.jpg" alt="Plaifha" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <p className="about-member-name">Plaifha Pumcharoen</p>
            <p className="about-member-role">Email: 65070132@kmitl.ac.th</p>
          </div>

        </div>
      </div>
      <footer className="about-footer">
        <hr className="about-footer-rule" />
        <p className="about-footer-copy">COPYRIGHT 2026</p>
        <p className="about-footer-inst">SCHOOL OF INFORMATION TECHNOLOGY</p>
        <p className="about-footer-inst">KING MONGKUT'S INSTITUTE OF TECHNOLOGY LADKRABANG</p>
      </footer>

    </div>
  );
}

export default Home_infor;
