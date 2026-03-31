// THIS FILE IS FOR TESTING HOW THE SOCIAL COMPONENTS ACT/LOOK - DELETE LATER

import { useState } from "react";
import OrgCard from "../components/profile/connections/OrgCard.tsx";
import OrgModal from "../components/profile/connections/OrgModal.tsx";
import InboxCard, {type InboxItem} from "../components/profile/connections/InboxCard.tsx";

const orgsData = [
    { id: "1", name: "Organization 1", contact: "organization1@gmail.com", bio: "biography" },
    { id: "2", name: "Organization 2", contact: "organization2@gmail.com", bio: "biography" },
    { id: "3", name: "Organization 3", contact: "organization3@gmail.com", bio: "biography" },
    { id: "4", name: "Organization 4", contact: "organization4@gmail.com", bio: "biography" },
    { id: "5", name: "Organization 5", contact: "organization5@gmail.com", bio: "biography" },
];

const Friends = () => {
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [items, setItems] = useState<InboxItem[]>([
        {
            id: "1",
            type: "invite",
            title: "Organization 1 Invite",
            message: "You’ve been invited to join Organization 1.",
            org: { id: "1", name: "Organization 1", contact: "organization1@gmail.com", bio: "biography" },
            status: "pending",
        },
        {
            id: "2",
            type: "notification",
            title: "Pod Added",
            message: "You've been added to Pod 1.",
        },
        {
            id: "3",
            type: "invite",
            title: "Organization 2 Invite",
            message: "You’ve been invited to join Organization 2.",
            org: { id: "2", name: "Organization 2", contact: "organization2@gmail.com", bio: "biography" },
            status: "pending",
        },
        {
            id: "4",
            type: "invite",
            title: "Organization 3 Request",
            message: "User 1 requested to join Organization 3.",
            org: { id: "3", name: "Organization 3", contact: "organization3@gmail.com", bio: "biography" },
            status: "pending",
        },
    ]);


    const handleSelectOrg = (org) => {
        setSelectedOrg(org);
    };

    const handleCloseModal = () => {
        setSelectedOrg(null);
    };

    const handleAccept = (item: InboxItem) => {
        setItems((prev) =>
            prev.map((i) =>
                i.id === item.id ? { ...i, status: "accepted" } : i
            )
        );
    };

    const handleDecline = (item: InboxItem) => {
        setItems((prev) =>
            prev.map((i) =>
                i.id === item.id ? { ...i, status: "declined" } : i
            )
        );
    };

    const handleDelete = (id: string) => {
        setItems((prev) => prev.filter((i) => i.id !== id));
    };

    const handleSelectMail = (item: InboxItem) => {
        if (item.org) {
            setSelectedOrg(item.org);
        }
    };

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "60vh",
                    gap: "24px",
                }}
            >
                <OrgCard orgs={orgsData} onSelect={handleSelectOrg} />
                <InboxCard
                    items={items}
                    onSelect={handleSelectMail}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                    onDelete={handleDelete}
                />
                {selectedOrg && (
                    <OrgModal
                        show={!!selectedOrg}
                        onCancel={handleCloseModal}
                        org={selectedOrg}
                    />
                )}
            </div>
        </div>
    );
};

export default Friends;