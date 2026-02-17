import { useState } from "react";
import "../styles/FAQs.css";

const faqData = [
    {
        question: "example question 1",
        answer: "example answer 1"
    },
    {
        question: "example question 2",
        answer: "example answer 2"
    },
    {
        question: "example question 3",
        answer: "example answer 3"
    },
    {
        question: "example question 4",
        answer: "example answer 4"
    },
    {
        question: "example question 5",
        answer: "example answer 5"
    },
    {
        question: "example question 6",
        answer: "example answer 6"
    },
    {
        question: "example question 7",
        answer: "example answer 7"
    },
    {
        question: "example question 8",
        answer: "example answer 8"
    },
    {
        question: "example question 9",
        answer: "example answer 9"
    }
];

export default function FAQs() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const toggleFAQ = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <div className="faqs-container">
            <h1 className="faqs-header">Frequently Asked Questions</h1>
            {faqData.map((item, index) => (
                <div
                    key={index}
                    className={`faq-item ${openIndex === index ? "open" : ""}`}
                    onClick={() => toggleFAQ(index)}
                >
                    <div className="faq-question">
                        {item.question}
                    </div>
                    <div className="faq-answer">
                        <p>{item.answer}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}
