import React, {useState} from "react";
import type { Org } from "./OrgCard"
import "../../../styles/connections/ConnectionsCard.css";
import "../../../styles/connections/InboxCard.css";

export type InboxItem = {
    id: string;
    type: "invite" | "notification";
    title: string;
    message: string;
    org?: Org;
    status?: "pending" | "accepted" | "declined";
};

type InboxCardProps = {
    items: InboxItem[];
    onSelect?: (item: InboxItem) => void;
    onAccept?: (item: InboxItem) => void;
    onDecline?: (item: InboxItem) => void;
    onDelete?: (id: string) => void;
};

const InboxCard: React.FC<InboxCardProps> = ({items, onSelect, onAccept, onDecline, onDelete,}) => {
    const [deleteId, setDeleteId] = useState<string | null>(null);

    return (
        <div className="connections-card small">
            <div className="connections-list small">
                {items.length > 0 ? (
                    items.map((item) =>
                        deleteId === item.id ? (
                            <div key={item.id} className="connections-item">
                                <div className="confirm-delete">
                                    <p>Delete this message?</p>
                                    <div className="inbox-buttons">
                                        <button className="btn primary-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete?.(item.id);
                                                setDeleteId(null);
                                            }}
                                        >
                                            Yes
                                        </button>
                                        <button className="btn secondary-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteId(null);
                                            }}
                                        >
                                            No
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div
                                key={item.id}
                                className="connections-item"
                                onClick={() => item.org && onSelect?.(item)}
                            >
                                {!(item.type === "invite" && item.status === "pending") && (
                                    <button
                                        className="delete-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteId(item.id);
                                        }}
                                    >
                                        ×
                                    </button>
                                )}

                                <h3>{item.title}</h3>
                                <p>{item.message}</p>

                                <div className="inbox-buttons">
                                    {item.type === "invite" && item.status === "pending" && (
                                        <>
                                            <button
                                                className="btn primary-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAccept?.(item);
                                                }}
                                            >
                                                Accept
                                            </button>
                                            <button
                                                className="btn secondary-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDecline?.(item);
                                                }}
                                            >
                                                Decline
                                            </button>
                                        </>
                                    )}
                                </div>

                                {item.status && item.status !== "pending" && (
                                    <span className="status">
                                    {item.status === "accepted"
                                        ? "Accepted"
                                        : item.status === "declined"
                                            ? "Declined"
                                            : ""}
                                </span>
                                )}
                            </div>
                        )
                    )
                ) : (
                    <p className="no-results">No messages</p>
                )}
            </div>
        </div>
    );
};

export default InboxCard;