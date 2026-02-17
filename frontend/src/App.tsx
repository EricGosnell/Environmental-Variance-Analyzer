import "leaflet/dist/leaflet.css";
import 'leaflet-control-geocoder/dist/Control.Geocoder.css';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";

import Home from "./pages/Home";
import About_TheEVAPod from "./pages/About-theEVAPod";
import About_AssemblyInstructions from "./pages/About-assemblyInstructions";
import About_MeetCarma from "./pages/About-meetCARMA";
import About_NASASTELLA from "./pages/About-NASASTELLA";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Copyright from "./pages/Copyright";
import FAQs from "./pages/FAQs";
import Profile from "./pages/Profile"
import Friends from "./pages/Friends"
import Pod from "./pages/Pod";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<MainLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/about-the-EVA-pod" element={<About_TheEVAPod />} />
                    <Route path="/about-assembly-instructions" element={<About_AssemblyInstructions />} />
                    <Route path="/about-NASA-STELLA" element={<About_NASASTELLA />} />
                    <Route path="/about-meet-CARMA" element={<About_MeetCarma />} />
                    <Route path="/contact-us" element={<Contact />} />
                    <Route path="/terms-and-conditions" element={<Terms />} />
                    <Route path="/privacy-statement" element={<Privacy />} />
                    <Route path="/copyright-and-other-notices" element={<Copyright />} />
                    <Route path="/faqs" element={<FAQs />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/friends" element={<Friends />} />
                    <Route path="/pod/:podId" element={<Pod />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
