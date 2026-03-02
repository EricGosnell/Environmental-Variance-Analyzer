import "../styles/InfoPages.css";
import headshot_barbra_sobhani from "../assets/Headshot_Barbra_Sobhani.jpg";
import headshot_annie_strange from "../assets/Headshot_Annie_Strange.jpg";
import headshot_collette_wilfong from "../assets/Headshot_Collette_Wilfong.jpg";
import headshot_mark_kettles from "../assets/Headshot_Mark_Kettles.jpg";
import cosgc_logo from "../assets/COSGC_Logo.jpeg";

const members = [
    {
        id: 1,
        name: "Barbra Sobhani",
        role: "Director",
        email: "barbra.sobhani@colorado.edu",
        image: headshot_barbra_sobhani
    },
    {
        id: 2,
        name: "Annie Strange",
        role: "Program Manager",
        email: "annie.strange@colorado.edu",
        image: headshot_annie_strange
    },
    {
        id: 3,
        name: "Collette Wilfong",
        role: "Manager of Student Projects",
        email: "collette.wilfong@colorado.edu",
        image: headshot_collette_wilfong
    },
    {
        id: 4,
        name: "Mark Kettles",
        role: "Research Manager",
        email: "mark.kettles@colorado.edu",
        image: headshot_mark_kettles
    },
    {
        id: 5,
        name: "Maura Thomas",
        role: "CARMA Project Manager",
        email: "math8010@colorado.edu",
        image: cosgc_logo
    }
]

export default function About_MeetCarma() {
    return (
        <div className="info-container">
            <div className="info-card">
                <div className="info-header">
                    <h1 className="info-title">Meet the CARMA Team</h1>
                </div>
                <div className="info-body">
                    <h2 className="info-subheader">What is CARMA?</h2>
                    <p className="info-content">
                        The CU Boulder Climate Adaptation and Resilience Monitoring Alliance (CARMA) team is a multidisciplinary team of researchers, students, and experts committed to exploring the impacts of climate change on communities worldwide by carrying out a variety of innovative projects. Through collaboration and hands-on research, members work together towards the advancements of environmental science and engineering in new, creative, and inventive ways.
                    </p>
                    <h2 className="info-subheader">CARMA and STELLA</h2>
                    <p className="info-content">
                        One of CARMA’s projects includes using NASA’s STELLA spectroscopy device to test its capabilities in measuring the impacts of climate change on plant health across a range of vulnerable environments. By reading the reflected levels of Near-Infrared (NIR) and visible red, green, and blue wavelengths, CARMA can detect physiological stress in plants before any visual symptoms appear. CARMA also works to validate the accuracy and reliability of the STELLA device for broader use in climate research, environmental monitoring, and agricultural applications.
                    </p>
                    <p className="info-content">
                        For more information on CARMA, including related programs, see NASA Colorado Space Grant Consortium’s{" "}
                        <a href="https://www.colorado.edu/center/spacegrant/climate-projects" target="_blank" className="info-link">
                            Earth System Projects.
                        </a>
                    </p>
                    <h2 className="info-subheader">COSGC</h2>
                    <p className="info-content">
                        CARMA is proud to be part of the Colorado Space Grant Consortium (COSGC), which is a state-wide program that provides Colorado students access to space through innovative courses and NASA-aligned projects. More information on the COSGC can be found on{" "}
                        <a href="https://www.colorado.edu/center/spacegrant/" target="_blank" className="info-link">
                            their website.
                        </a>
                    </p>
                    <h2 className="info-subheader">CARMA's Leadership</h2>
                    <p className="info-content">
                        Along with a dedicated team of students, experts, and researchers, the leadership of COSGC and CARMA oversees the diverse range of projects CARMA executes.
                    </p>
                    <div className="members-container">
                        {members.map(member => (
                            <div key={member.id} className="members-card">
                                <img src={member.image} alt={member.name} className="members-image" />
                                <div className="members-content">
                                    <h3>{member.name}</h3>
                                    <p>{member.role}</p>
                                    <a href={member.email} target="_blank" className="info-link">
                                        {member.email}
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}