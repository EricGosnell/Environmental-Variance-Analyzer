import "leaflet/dist/leaflet.css";
import 'leaflet-control-geocoder/dist/Control.Geocoder.css';
import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom";
import MainLayout from "./layouts/MainLayout";

import Home from "./pages/Home";
import About_TheEVAPod from "./pages/About-theEVAPod";
import About_AssemblyInstructions from "./pages/About-assemblyInstructions";
import About_MeetCarma from "./pages/About-meetCARMA";
import About_NASASTELLA from "./pages/About-NASASTELLA";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import FAQs from "./pages/FAQs";
import Profile from "./pages/Profile"
import Friends from "./pages/Friends"
import Pod from "./pages/Pod";
import VerifyEmail from "./pages/VerifyEmail";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<MainLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/about">
                        <Route index element={<Navigate to="EVA-pod" replace />} />
                        <Route path="EVA-pod" element={<About_TheEVAPod />} />
                        <Route path="assembly-instructions" element={<About_AssemblyInstructions />} />
                        <Route path="NASA-STELLA" element={<About_NASASTELLA />} />
                        <Route path="meet-CARMA" element={<About_MeetCarma />} />
                    </Route>
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/faqs" element={<FAQs />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/settings" element={<Navigate to="/profile" replace />} />
                    <Route path="/friends" element={<Friends />} />
                    <Route path="/pod/:podId" element={<Pod />} />
                    <Route path="/verify-email" element={<VerifyEmail />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
