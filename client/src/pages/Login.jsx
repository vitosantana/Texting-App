import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../api/auth';

function Login() {
    const [form, setForm] = useState({ username: '', password: '' });
    const navigate = useNavigate();

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const { data } = await loginUser(form);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            navigate('/home');
        } catch (error) {
            console.log(error.response?.data);
            alert(error.response?.data?.message ||'Login failed');
        }
        }

    return (
        <div>
            <h1>Login</h1>
            <form onSubmit={handleSubmit}>
                <input
                name= "username"
                placeholder="Username"
                value={form.username}
                onChange={handleChange}
            />
            <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            />
            <button type="submit">Login</button>
            </form>
            <p>
                No account? <Link to="/register">Register</Link>
            </p>
        </div>
    );
}

export default Login;