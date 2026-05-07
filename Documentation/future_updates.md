# Upload route
* The fundamentals of the upload route have been finished, though testing has shown bugs/errors so it will require some work to finish.
* The goal of upload route is accept a json file -> make sure each item in json is for the same pod -> make sure pod belongs to user /user is admin -> batch upload data

# Organizations
* organizations has partial backend implementation, such as in the db.sql, but apis and frontend have not added functionality yet

# Pod movement
* currently pod locations can be changed with the db.sql storing new data after location change at the new location without affecting the old data. The frontend does not reflect this, to keep the old info and start storing the data at the new location one of the suggestions was to create a completely new pod in the db.sql, and labeling the older location as a ghost pod. This would leave the older pod unaffected and create a new pod at the new location. There are other ways to implement the location change but this seems to be the simplest as it wouldn't require other apis to be changed.

# Profile Page Updates
Most of work on implementing organizations and shared pods should be done in `Profile.tsx`, in order to achieve this here is a list of what needs to be looked at.
* The history tab will need to be reworked to show changes made by pods not owned by the current user. That is, if a user is part of an organization or has a shared pod, actions taken by other users with access to that pod should appear in the history tab
* There is some framework for adding a tab for collaborators/organizations, but none of the frontend funcitonality is present. Our vision was that the empty space on the left of the Profile page (that currently says 'Organizations, coming soon!') could be used to list what orgs a user is currently part of. Just to take up space on the page really. Then the dedicated tab would be used for things like sending and receiving invtiations, removing oneself from an org, and all the other actual functions you feel you need to have. 
* In general, there are many optimizations in efficiency that the Profile page could receive. We didn't have the time to properly punish and bugfix everything there. First and foremost we would suggest slimming it down using more refactoring and hooks as its currently a 600 line behemoth. 
* Known Bug: Sometimes editing a pod's info will cause a Network Error that prevents the update. We don't know what's causing it and retrying the command immediately after works perfectly fine. I suspect it might be related to a problem sending the info from the API route to the database when first logging in, but that's just speculation. Since the request works right after I'm deeming it noncritical but should definitely be looked into.
* MAKE SURE THE EMAIL AND PASSWORD UPDATING WORKS ON THE SERVER SETUP YOU USE!! Brevo and docker and AWS can be very finicky, test those critical functions ASAP whenever you make a change to your server setup

# Admin Routes
* Frankly the state `/backend/API/admin.js` of is a total mess. There was miscommunication between members and the purpose of `/admin.js`, to verify if a user was admin and give them special permissions as outlined in `API_Routes.md` ended up existing across other API routes in the form of checks and flags. So the `/admin.js` has gone essentially unimplemented in the current state of the website. They're not even mounted in `/server.js` We're leaving the routes still around, in case you make the decision to refactor to include them, and in case you find a need for them in the future. That judgement call is up to you.
