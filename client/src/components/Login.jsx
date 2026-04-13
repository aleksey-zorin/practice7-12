import { useState } from "react";
import axios from "axios";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        
        try {
            const response = await axios.post("http://localhost:3000/api/auth/login", {
                email: email,
                password: password
            });
            
            console.log("Ответ:", response.data);
            
            if (response.data.accessToken) {
                localStorage.setItem("accessToken", response.data.accessToken);
                setSuccess(true);
            } else {
                setError("Токен не получен");
            }
        } catch (err) {
            console.error("Ошибка:", err);
            setError("Ошибка: " + (err.response?.data?.error || err.message));
        }
    };

    if (success) {
        return (
            <div style={{ background: "#0b0f19", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <div style={{ background: "#1a1f2e", padding: 40, borderRadius: 16, textAlign: "center" }}>
                    <h1 style={{ color: "#4ade80" }}>✅ Успешный вход!</h1>
                    <p style={{ color: "white" }}>Токен сохранён в localStorage</p>
                    <p style={{ color: "#888" }}>accessToken: {localStorage.getItem("accessToken")?.substring(0, 50)}...</p>
                    <button onClick={() => window.location.href = "/products"} style={{ marginTop: 20, padding: "10px 20px", background: "#4f46e5", border: "none", borderRadius: 8, color: "white", cursor: "pointer" }}>Перейти к товарам</button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: "#0b0f19", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ background: "#1a1f2e", padding: 40, borderRadius: 16, width: 400 }}>
                <h1 style={{ color: "white", textAlign: "center" }}>Вход</h1>
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
                    {error && <p style={{ color: "#ef4444", textAlign: "center" }}>{error}</p>}
                    <button type="submit" style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "#4f46e5", color: "white", cursor: "pointer" }}>Войти</button>
                </form>
            </div>
        </div>
    );
}