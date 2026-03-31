import React, {useEffect, useState} from "react";
import type { Org } from "./OrgCard.tsx"
import "../../../styles/connections/OrgModal.css";

type OrgModalProps = {
    show: boolean;
    onCancel: () => void;
    org: Org;
}

const OrgModal: React.FC<OrgModalProps> = ({ show, onCancel,org }) => {
    const [status, setStatus] = useState<"none" | "requested" | "joined">("none");

    // api handling - fix when apis are implemented
    const handleRequest = async () => {
        try {
            await fetch(`/api/orgs/${org.id}/request`, {
                method: "POST",
            });
            setStatus("requested");
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (!show) return;
        const fetchStatus = async () => {
            const res = await fetch(`/api/orgs/${org.id}/status`);
            const data = await res.json();
            setStatus(data.status);
        };
        fetchStatus();
    }, [show, org.id]);

    if (!show) return null;

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onCancel}>×</button>
                <div className="modal-header">
                    <h2>{org.name}</h2>
                </div>
                <p className="org-contact">Contact: {org.contact}</p>
                <p className="org-bio">{org.bio}</p>
                <footer className="modal-footer">
                    <button
                        className="btn primary-btn"
                        onClick={() => handleRequest()}
                        disabled={status === "requested" || status === "joined"}
                    >
                        {status === "none"
                            ? "Request to Join"
                            : status === "requested"
                                ? "Requested"
                                : "Joined"}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default OrgModal;