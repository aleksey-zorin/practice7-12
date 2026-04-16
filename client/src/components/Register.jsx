import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

export default function Register() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        
        try {
            await axios.post("http://localhost:3000/api/auth/register", {
                email,
                password,
                first_name: firstName,
                last_name: lastName
            });
            setSuccess(true);
            setTimeout(() => navigate("/login"), 2000);
        } catch (err) {
            setError(err.response?.data?.error || "Ошибка регистрации");
        }
    };

    if (success) {
        return (
            <div style={{ background: "#0b0f19", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <div style={{ background: "#1a1f2e", padding: 40, borderRadius: 16, textAlign: "center" }}>
                    <h1 style={{ color: "#4ade80" }}>✅ Регистрация успешна!</h1>
                    <p style={{ color: "white" }}>Перенаправление на страницу входа...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: "#0b0f19", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ background: "#1a1f2e", padding: 40, borderRadius: 16, width: 400 }}>
                <h1 style={{ color: "white", textAlign: "center" }}>Регистрация</h1>
                <form onSubmit={handleSubmit}>
                    <input 
                        type="email" 
                        placeholder="Email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        style={{ width: "100%", padding: 12, marginBottom: 15, borderRadius: 8, border: "1px solid #333", background: "#2a2f3e", color: "white" }} 
                        required 
                    />
                    <input 
                        type="password" 
                        placeholder="Пароль" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        style={{ width: "100%", padding: 12, marginBottom: 15, borderRadius: 8, border: "1px solid #333", background: "#2a2f3e", color: "white" }} 
                        required 
                    />
                    <input 
                        type="text" 
                        placeholder="Имя" 
                        value={firstName} 
                        onChange={e => setFirstName(e.target.value)} 
                        style={{ width: "100%", padding: 12, marginBottom: 15, borderRadius: 8, border: "1px solid #333", background: "#2a2f3e", color: "white" }} 
                        required 
                    />
                    <input 
                        type="text" 
                        placeholder="Фамилия" 
                        value={lastName} 
                        onChange={e => setLastName(e.target.value)} 
                        style={{ width: "100%", padding: 12, marginBottom: 15, borderRadius: 8, border: "1px solid #333", background: "#2a2f3e", color: "white" }} 
                        required 
                    />
                    {error && <p style={{ color: "#ef4444", textAlign: "center" }}>{error}</p>}
                    <button type="submit" style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "#4f46e5", color: "white", cursor: "pointer" }}>Зарегистрироваться</button>
                </form>
                <p style={{ textAlign: "center", marginTop: 20, color: "#888" }}>
                    Уже есть аккаунт? <Link to="/login" style={{ color: "#4f46e5" }}>Войти</Link>
                </p>
            </div>
        </div>
    );
}