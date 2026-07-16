import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../api/auth';
import './Register.css';

function Register() {
    const [form, setForm] = useState({ username: '', password: '', email: '', birthMonth: '', birthDay: '', birthYear: '' });
    const navigate = useNavigate();

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
          console.log('register submit fired');

       try {
        await registerUser({
            email: form.email,
            username: form.username,
            password: form.password,
            dob: `${form.birthMonth} ${form.birthDay}, ${form.birthYear}`
        });

        alert('Account created successfully');
        navigate('/login');
       } catch (error) {
        alert(error.response?.data?.message || 'Registration failed')
       }
    };
    return (
        <div className="register-page">
            <div className="register-bg-glow register-bg-glow-1"></div>
            <div className="register-bg-glow register-bg-glow-2"></div>
            <div className="register-bg-glow register-bg-glow-3"></div>

            <header className="register-topbar">
                <Link to="/" className="register-brand">
                Causerie
                </Link>
            </header>

            <main className="register-center">
                <div className="register-card">
                    <div className="register-panel">
                        <h1>Create an account</h1>
                        <p className="register-subtext">
                            Join and start chatting.
                        </p>

                        <form onSubmit={handleSubmit} className="register-form">
                            <label htmlFor="email">Email</label>
                            <input 
                            id="email"
                            name="email"
                            type="email"
                            value={form.email}
                            onChange={handleChange}
                            placeholder="Enter your email"
                            required
                            />

                            <label htmlFor="username">Username</label>
                            <input 
                            id="username"
                            name="username"
                            type="text"
                            value={form.username}
                            onChange={handleChange}
                            placeholder="Choose a username"
                            required
                            />

                            <label htmlFor="password">Password</label>
                            <input 
                            id="password"
                            name="password"
                            type="password"
                            value={form.password}
                            onChange={handleChange}
                            placeholder="Create a password"
                            required
                            />

                            <label className="dob-label">Date of Birth</label>

                            <div className="dob-row">
                                <select
                                name="birthMonth"
                                value={form.birthMonth}
                                onChange={handleChange}
                                required
                                >
                                <option value="">Month</option>
                                <option value="January">January</option>
                                <option value="February">February</option> 
                                <option value="March">March</option> 
                                <option value="April">April</option> 
                                <option value="May">May</option> 
                                <option value="June">June</option> 
                                <option value="July">July</option> 
                                <option value="August">August</option> 
                                <option value="September">September</option> 
                                <option value="October">October</option> 
                                <option value="November">November</option> 
                                <option value="December">December</option>     
                                </select>
                                
                                <select
                                name="birthDay"
                                value={form.birthDay}
                                onChange={handleChange}
                                required
                                >
                                    {/* Make an array of 31 items(days) */}
                                    <option value="">Day</option>
                                    {Array.from({ length: 31 }, (_, i) => (
                                        <option key={i + 1} value= {i + 1}>{i + 1}</option>
                                    ))}
                                </select>

                                <select
                                name="birthYear"
                                value={form.birthYear}
                                onChange={handleChange}
                                required
                                >
                                    {/* Generates a 100 year options */}
                                    <option value="">Year</option>
                                    {Array.from({ length: 100 }, (_, i) => {
                                        const year = new Date().getFullYear() -i;
                                        return (
                                            <option key={year} value={year}>{year}</option>
                                        );
                                    })}
                                </select>
                                    
                            </div>

                           

                            <button type="submit" className="register-submit-btn">
                                Create Account
                            </button>
                        </form>

                        <p className="register-footer-text">
                            Already have an account? <Link to="/login">Log In</Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Register;