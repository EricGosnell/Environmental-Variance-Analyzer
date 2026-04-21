# Organizations Documentation
This document outlines the design, current implementation, and remaining work for the organizations/connections feature in the user profile. All current implementations are found in the `feat/orgs` branch.

## End Goal
The Connections tab in the profile page should contain the following:

### Organization Discovery
After they are signed in, users should be able to
* Browse all organizations on the platform
* View all the organizations that are currently a part of
* View details about each organization - name, email, biography (100 characters max)
* Request to join an organization

### Roles and Permissions
Organization members can be one of two roles
* Admin (note that this is different from the website admin)
  * Can edit or delete the organization
  * Can send invitations for users to join
  * Can accept join requests, promote members to admin, and remove users 
* Member
  * View organization pods

### Inbox
Inbox should be able to receive
* Organization invites
* Join requests (if the user is an organization admin)
* Shared pod notifications

Users should be able to 
* Accept or decline requests/invites 
* Delete messages

### Pod Integration
* Organizations should be able to own pods
* Organization pods should be shared to all members
* Private pods should be visible to all organization members
* "Manage Pods" table in the user profile should contain filters for organization pods

## Current Implementation
For the frontend:
* `frontend/src/components/profile/connections/InboxCard.tsx`
  * Inbox card containing a list of requests, invites, and shared pods notifications
  * Pending invites/requests can be accepted or denied
  * Non-pending messages can be deleted after confirmation
  * Messages can be clicked to open associated organization info modal
* `frontend/src/components/profile/connections/OrgCard.tsx`
  * Card displaying a searchable list of organizations
  * Contains client-side filtering by organization name
  * List items can be clicked to open associated organization info modal
* `frontend/src/components/profile/connections/OrgModal.tsx` 
  * Modal displaying organization details - name, email, bio
  * Contains "Request to Join" button with alternate texts depending on status
* `frontend/src/pages/Friends.tsx` 
  * Demo page to visualize components to be used in the Connections tab
  * Uses mock data for organizations and messages
* `frontend/src/utils/api.ts`
  * added functions for API routes to use in frontend
  * for organizations: `getAllOrgs`, `getUserOrgs`, `getOrgById`, `getOrgStatus`. `requestToJoinOrg`
  * for messages: `getMessages`, `respondToMessage`, `deleteMessage`
* `frontend/src/utils/apiTypes.ts`
  * added shared types used by APIs to use in frontend
  * for organizations: `Org`, `OrgResponse`, `OrgStatus`, `OrgStatusResponse`
  * for messages: `MessageType`, `MessageStatus`, `Message`, `MessagesResponse`
* `frontend/src/styles/connections/ConnectionsCard.css`
  * Styling for all the cards to be used in the Connection tab
* `frontend/src/styles/connections/InboxCard.css`
* `frontend/src/styles/connections/OrgCard.css`
* `frontend/src/styles/connections/OrgModal.css`

For the backend:
Some APIs are implemented, none are tested. 
* `backend/API/org.js`
  * `GET /orgs` - returns all organizations the user is a part of
  * `GET /orgs/all` - returns all organizations
  * `GET /orgs/:orgId` - returns organization information
  * `GET /orgs/:orgId/status` - returns a user's status for joining an org
  * `POST /orgs/create-org` - create a new organization and makes the user an org admin
  * `POST /orgs/:orgId/invite` - creates an invitation from organization to user
  * `POST /orgs/:orgId/request` - creates a request from the user to join an organization
  * `PUT /orgs/:orgId/change-org` - change organization details
  * `PUT /orgs/:orgID/members/:userId/change-role` - change organization member role to admin and grants permissions
  * `DELETE /orgs/:orgId/leave` - removes a user from organization when they leave
  * `DELETE /orgs/:orgId/members/:userId` - admin removes a user from organization
  * `DELETE /orgs/:orgId/delete-org` - deletes organization
* `backend/API/message.js`
  * `GET /messages` - returns all messages for the user
  * `PUT /messages/:messageId/respond` - accept or deny invites/requests
  * `DELETE /messages/:messageId` - deletes message
* `backend/database/db.sql`
  * Created tables
    * `org` 
    * `user_org`
    * `message`
  * Created indexes
    * `idx_user_org_user_id`
    * `idx_user_org_org_id`

Other:
* `Documentation/database_diagram.md`
  * Provides details on added database tables and relationships
* `Documentation/API_routes.md`
  * Provides details on added API routes

## What Needs to Be Done
* Add permissions to website admins to manage organizations and messages
* Add feature where users click on a shared pod message to navigate to the associated pod info page
* Add email validation to create org
* Add middleware for create org validation
* Add test data to backend
* Add `orgQueries.js` to use for repeating queries in `org.js` (ex: `isAdmin`, `isMember`)
* Add frontend for org admin features (create, edit, delete org)
* Add frontend for shared org pods features (share pod with org, profile filters, etc)
* Define organization pod permissions (who can add, edit, and delete pods)
* Revise APIs to handle edge cases
* Write additional APIs for shared organization pods
* Update `API_routes.md` for any new/changed APIs
* Test all routes
* Remove mock data in frontend
* Finish integrating APIs into frontend
* Incorporate organizations to the rest of profile
* Match styling to the rest of the website
