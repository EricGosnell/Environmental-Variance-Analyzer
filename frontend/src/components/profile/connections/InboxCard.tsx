import React, {useState} from "react";
import "../../../styles/connections/ConnectionsCard.css";
import "../../../styles/connections/InboxCard.css";
import type {Org} from "../../../utils/apiTypes.ts";

export type InboxItem = {
    id: number;
    type: "invite" | "request" | "shared_pod";
    title: string;
    message: string;
    org?: Org;
    status?: "pending" | "accepted" | "denied";
};

type InboxCardProps = {
    items: InboxItem[];
    onSelect?: (item: InboxItem) => void;
    onAccept?: (id: InboxItem) => void;
    onDecline?: (id: InboxItem) => void;
    onDelete?: (id: number) => void;
};

const InboxCard: React.FC<InboxCardProps> = ({items, onSelect, onAccept, onDecline, onDelete,}) => {
    const [deleteId, setDeleteId] = useState<number | null>(null);

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
                                    {!(item.type === "shared_pod") && item.status === "pending" && (
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
                                        : item.status === "denied"
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