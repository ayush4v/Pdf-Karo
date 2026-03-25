import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import '../App.css';

export function Login({ setUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (email && password) {
      const userData = { email, name: email.split('@')[0], avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + email };
      localStorage.setItem('pdfkaro_user', JSON.stringify(userData));
      setUser(userData);
      navigate('/');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">Welcome Back</h2>
        <p className="auth-subtitle">Login to PdfKaro to manage your documents</p>
        <form onSubmit={handleLogin} className="auth-form">
          <div className="input-group">
            <Mail className="input-icon" />
            <input type="email" placeholder="Email Address" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="input-group">
            <Lock className="input-icon" />
            <input type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-massive btn-auth">
            Login <ArrowRight size={20} />
          </button>
        </form>
        <div className="auth-footer">
          Don't have an account? <Link to="/signup">Sign Up</Link>
        </div>
      </div>
    </div>
  );
}

export function SignUp({ setUser }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSignup = (e) => {
    e.preventDefault();
    if (name && email && password) {
      const userData = { email, name, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + email };
      localStorage.setItem('pdfkaro_user', JSON.stringify(userData));
      setUser(userData);
      navigate('/');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">Create Account</h2>
        <p className="auth-subtitle">Join PdfKaro for premium cloud features</p>
        <form onSubmit={handleSignup} className="auth-form">
          <div className="input-group">
            <User className="input-icon" />
            <input type="text" placeholder="Full Name" required value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="input-group">
            <Mail className="input-icon" />
            <input type="email" placeholder="Email Address" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="input-group">
            <Lock className="input-icon" />
            <input type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-massive btn-auth">
            Create Account <ArrowRight size={20} />
          </button>
        </form>
        <div className="auth-footer">
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
}
