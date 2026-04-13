import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Products() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("accessToken");
        if (!token) {
            navigate("/login");
            return;
        }

        axios.get("http://localhost:3000/api/products", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
        .then(response => {
            setProducts(response.data);
            setLoading(false);
        })
        .catch(err => {
            console.error(err);
            setError("Ошибка загрузки товаров");
            setLoading(false);
        });
    }, [navigate]);

    const logout = () => {
        localStorage.clear();
        navigate("/login");
    };

    if (loading) {
        return (
            <div style={{ background: "#0b0f19", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", color: "white" }}>
                Загрузка...
            </div>
        );
    }

    return (
        <div style={{ padding: 20, background: "#0b0f19", minHeight: "100vh", color: "white" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h1 style={{ margin: 0 }}>Спортивный магазин</h1>
                <button onClick={logout} style={{ padding: "10px 20px", background: "#ef4444", border: "none", borderRadius: 8, color: "white", cursor: "pointer" }}>Выйти</button>
            </div>

            {error && <p style={{ color: "#ef4444", textAlign: "center" }}>{error}</p>}

            {products.length === 0 && !error ? (
                <p style={{ textAlign: "center", color: "#888" }}>Нет товаров. Добавьте первый товар через Swagger (POST /api/products)</p>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
                    {products.map(p => (
                        <div key={p.id} style={{ background: "#1a1f2e", padding: 15, borderRadius: 12, border: "1px solid #333" }}>
                            <h3 style={{ color: "#a5f3fc", margin: "0 0 10px 0" }}>{p.title}</h3>
                            <p style={{ color: "#888", fontSize: 14, marginBottom: 10 }}>{p.category || "Без категории"}</p>
                            <p style={{ color: "#ccc", fontSize: 14, marginBottom: 10 }}>{p.description || "Нет описания"}</p>
                            <p style={{ color: "#4ade80", fontSize: 18, fontWeight: "bold" }}>{p.price} ₽</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}