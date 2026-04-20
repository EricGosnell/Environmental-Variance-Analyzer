import React, {useEffect, useState} from "react";
import "../../../styles/connections/OrgModal.css";
import type {Org, OrgStatus} from "../../../utils/apiTypes.ts";
import {getOrgStatus, requestToJoinOrg} from "../../../utils/api.ts";

type OrgModalProps = {
    show: boolean;
    onCancel: () => void;
    org: Org;
}

const OrgModal: React.FC<OrgModalProps> = ({ show, onCancel, org }) => {
    const [status, setStatus] = useState<OrgStatus>("none");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!show) return;
        const fetchStatus = async () => {
            try {
                const res = await getOrgStatus(org.id);
                setStatus(res.status);
            } catch (err) {
                console.error(err);
                setStatus("none");
            }
        };
        fetchStatus();
    }, [show, org.id]);

    const handleRequest = async () => {
        if (loading) return;

        try {
            setLoading(true);
            await requestToJoinOrg(org.id);
            setStatus("requested");
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!show) return null;

    const getButtonText = () => {
        if (loading) return "Loading...";

        switch (status) {
            case "none":
                return "Request to Join";
            case "requested":
                return "Requested";
            case "joined":
                return "Joined";
            case "invited":
                return "Invited";
            default:
                return "Request to Join";
        }
    };

    const isDisabled =
        loading ||
        status === "requested" ||
        status === "joined" ||
        status === "invited";

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
                        onClick={handleRequest}
                        disabled={isDisabled}
                    >
                        {getButtonText()}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default OrgModal;