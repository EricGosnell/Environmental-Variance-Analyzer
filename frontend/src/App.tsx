import "leaflet/dist/leaflet.css";
import 'leaflet-control-geocoder/dist/Control.Geocoder.css';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";

import Home from "./pages/Home";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Profile from "./pages/Profile"
import Pod from "./pages/Pod";
import ManagePods from "./pages/ManagePods";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<MainLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/pod/:podId" element={<Pod />} />
                    <Route path="/manage-pods" element={<ManagePods />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
