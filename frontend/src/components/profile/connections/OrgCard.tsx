import React, { useState } from "react";
import {FiSearch} from "react-icons/fi";
import "../../../styles/connections/ConnectionsCard.css";
import "../../../styles/connections/OrgCard.css";

export type Org = {
    id: string;
    name: string;
    contact: string;
    bio: string;
};

type OrgCardProps = {
    orgs: Org[];
    onSelect: (org: Org) => void;
};

const OrgCard: React.FC<OrgCardProps>  = ({ orgs, onSelect }) => {
    const [search, setSearch] = useState("");

    const filteredOrgs = orgs.filter((org) =>
        org.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="connections-card medium">
            <div className="search-wrap">
                <FiSearch size={16} className="search-icon" aria-hidden="true" />
                <input
                    type="text"
                    placeholder="Search organizations"
                    className="search-bar"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <div className="connections-list medium">
                {filteredOrgs.length > 0 ? (
                    filteredOrgs.map((org, index) => (
                        <div
                            key={index}
                            className="connections-item"
                            onClick={() => onSelect(org)}
                        >
                            <h3>{org.name}</h3>
                            <p>{org.contact}</p>
                        </div>
                    ))
                ) : (
                    <p className="no-results">No organizations found</p>
                )}
            </div>
        </div>
    );
};

export default OrgCard;