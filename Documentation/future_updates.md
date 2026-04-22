# Upload route
* The fundamentals of the upload route have been finished, though testing has shown bugs/errors so it will require some work to finish.
* The goal of upload route is accept a json file -> make sure each item in json is for the same pod -> make sure pod belongs to user /user is admin -> batch upload data

# Organizations
* organizations has partial backend implementation, such as in the db.sql, but apis and frontend have not added functionality yet

# Pod movement
* currently pod locations can be changed with the db.sql storing new data after location change at the new location without affecting the old data. The frontend does not reflect this, to keep the old info and start storing the data at the new location one of the suggestions was to create a completely new pod in the db.sql, and labeling the older location as a ghost pod. This would leave the older pod unaffected and create a new pod at the new location. There are other ways to implement the location change but this seems to be the simplest as it wouldn't require other apis to be changed.