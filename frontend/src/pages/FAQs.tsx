import { useState } from "react";
import "../styles/FAQs.css";

const faqs = [
    {
        category: "Account Settings",
        questions: [
            {
                question: "How do I create an account?",
                answer: "Go to the homepage by clicking “Environmental Variance Analyzer” at the top left of the webpage. In the Log In panel, click “Sign Up” and complete the registration form."
            },
            {
                question: "Can I change my account information?",
                answer: "Yes. After logging in, hover over “Profile” in the top right corner and select “Settings.” You can also click “Profile” and access “Settings” from the left navigation menu."
            },
            {
                question: "What if I forgot my password?",
                answer: "From the homepage, click “Forgot Password?” in the Log In panel and follow the instructions to reset your password."
            },
            {
                question: "Can I delete my account?",
                answer: "Yes. Go to your account settings through your profile and click “Delete Account” at the bottom of the page. You will be asked to confirm before deletion."
            }
        ]
    },
    {
        category: "EVA Pod Management",
        questions: [
            {
                question: "How do I register a new EVA Pod?",
                answer: "After logging in, click “Add EVA Pod” in the Controls panel on the left side of the homepage and complete the form with your pod’s information."
            },
            {
                question: "Can I edit an existing EVA Pod?",
                answer: "Yes. Click “Edit EVA Pod” in the Controls panel and update the pod’s information as needed."
            },
            {
                question: "Can I own an EVA Pod with someone else?",
                answer: "Yes. You can add collaborators when creating a new pod or editing an existing one."
            },
            {
                question: "What is the difference between public and private EVA Pods?",
                answer: "Public EVA Pods are visible to all users on the site. Private EVA Pods are only visible to their designated owners and collaborators."
            },
            {
                question: "How can I access more information about a specific EVA Pod?",
                answer: "Hover over a pod on the map to see a summary. Click on the pod to open the full Pod Details page. Logged-in users can also access this page through “Manage Pods” in their profile."
            },
            {
                question: "Where can I view all of my EVA Pods?",
                answer: "Log in and click “Profile” in the top right corner. Select the “Your Pods” card or click “Manage Pods” in the left navigation menu."
            },
            {
                question: "Can I delete my EVA Pods?",
                answer: "Yes. Open the Pod Details page for the selected pod and click “Delete Pod” at the bottom of the page. You will be asked to confirm."
            }
        ]
    },
    {
        category: "Map & Data Display",
        questions: [
            {
                question: "Where can I find the interactive map?",
                answer: "The interactive map is located on the homepage and can be accessed at any time by clicking “Environmental Variance Analyzer” in the top left corner."
            },
            {
                question: "What information does the map show?",
                answer: "The map displays public EVA Pods, private EVA Pods (if enabled), and STELLA data points at their respective locations."
            },
            {
                question: "What kind of data can I view from an EVA Pod?",
                answer: "Each Pod Details page includes the pod name, coordinates, sensor readings, trend graphs, and historical data records."
            },
            {
                question: "How are EVA Pods displayed on the map?",
                answer: "Pods are shown at their recorded latitude and longitude coordinates. You can toggle display options to view pods as pins or with a coverage radius."
            },
            {
                question: "How can I adjust the map view?",
                answer: "Use the “+” and “–” buttons in the bottom right corner to zoom. Click and drag to move the map. Use the search bar to navigate to specific locations."
            },
            {
                question: "Can I change the basemaps?",
                answer: "Yes. Click the map layer icon in the bottom right corner to switch between street and satellite views."
            },
            {
                question: "How do I show or hide private EVA Pods on the map?",
                answer: "Use the “Private” toggle in the Control panel to show or hide private pods. Public pods remain visible at all times."
            },
            {
                question: "How do I show or hide STELLA points on the map?",
                answer: "Use the “STELLA Points” toggle in the Control panel to display or hide STELLA data points."
            },
            {
                question: "Can I view EVA data as a table?",
                answer: "Yes. An interactive data table is located below the map."
            },
            {
                question: "Will the map area change when I leave and return to the homepage?",
                answer: "No. The map will remain in the same position and zoom level as when you last viewed it."
            }
        ]
    },
    {
        category: "Tips & Troubleshooting",
        questions: [
            {
                question: "Who do I contact for help with the EVA Pod?",
                answer: "For hardware related questions or concerns, email cospacegrant@colorado.edu."
            }
        ]
    },
    {
        category: "Social Navigation",
        questions: [
            {
                question: "What are Friends?",
                answer: "Friends are other users you connect with to share EVA Pods or view their public pods."
            },
            {
                question: "Where can I view all of my friends?",
                answer: "Go to your profile and click the “Friends” card, or select “Friends” from the left navigation menu."
            },
            {
                question: "How do I add someone to my Friends list?",
                answer: "Navigate to the Friends page, search for the user’s username, and click “Send Friend Request.” They will become your Friend once they approve the request."
            },
            {
                question: "How do I accept or reject friend requests?",
                answer: "Go to the Friends page, open the “Manage Requests” tab, and choose “Accept” or “Reject” for each request."
            },
            {
                question: "Can I remove someone from my Friends list?",
                answer: "Yes. On the Friends page, click “Remove Friend” next to the user you want to remove and confirm the action."
            }
        ]
    }
];

export default function FAQs() {
    const [openIndex, setOpenIndex] = useState<string | null>(null);

    const toggleFAQ = (id: string) => {
        setOpenIndex(openIndex === id ? null : id);
    };

    return (
        <div className="faqs-container">
            <h1 className="faqs-header">Frequently Asked Questions</h1>
            {faqs.map((section, sectionIndex) => (
                <div key={sectionIndex}>
                    <h2 className="faqs-subheader">{section.category}</h2>
                    {section.questions.map((item, questionIndex) => {
                        const uniqueId = `${sectionIndex}-${questionIndex}`;
                        return (
                            <div key={uniqueId} className={`faq-item ${openIndex === uniqueId ? "open" : ""}`}>
                                <div className="faq-question" onClick={() => toggleFAQ(uniqueId)}>
                                    {item.question}
                                    <span>{openIndex === uniqueId ? "−" : "+"}</span>
                                </div>
                                <div className="faq-answer">
                                    <p>{item.answer}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}