import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; 
import Login from "./components/Login"; 
import Products from "./components/Products"; 
function App() { return ( <BrowserRouter> <Routes> <Route path="/login" element={<Login />} /> <Route path="/products" element={<Products />} /> <Route path="/" element={<Navigate to="/products" />} /> </Routes> </BrowserRouter> ); } 
export default App; 
