# GitHub Branches Information
This document briefly explains the purpose of each active branch remaining in the GitHub repository apart from `main`, their current status, and the remaining work left for each of them.

## Features
* `feature/add_data_modal`
  * **Description**: Contains frontend for upload pod feature.
  * **Status**: N/A
  * **Remaining Work**: Combine with backend once available.
* `feature/getUserPods`
  * **Description**: Contains `admin.js` which should be handled in its own branch and API to get all pods registered to the current user.
  * **Status**: N/A
  * **Remaining Work**: See pull request #41.
* `feature/ManagePodPage`
  * **Description**: Contains `admin.js` which should be handled in its own branch and implementation for Manage Pods page.
  * **Status**: Branch is likely not needed due to profile structure changes - needs review.
  * **Remaining Work**: Compare to `feature/ProfilePage_v2` to see if anything else from this branch is needed.
* `feature/ProfilePage`
  * **Description**: Contains `admin.js` which should be handled in its own branch and initial implementation of profile.
  * **Status**: N/A
  * **Remaining Work**: Compare to `feature/ProfilePage_v2` to see if anything else from this branch is needed.
* `feature/ProfilePage_v2`
  * **Description**: Contains implementation for profile feature, including pod management and account settings.
  * **Status**: Needs redesigning, testing, and refactoring.
  * **Remaining Work**: See `Documentation/future_updates.md` in the `documentation` branch.  
* `feat/orgs`
  * **Description**: Contains implementation for organization/connections features.
  * **Status**: Not finished. Needs testing, additional APIs, and frontend components.
  * **Remaining Work**: See `Documentation/organizations.md` in the `documentation` branch.
* `uploadAPI`
  * **Description**: Contains the API route for upload pod data.
  * **Status**: Needs bug fixes and additional testing.
  * **Remaining Work**: See `Documentation/future_updates.md` in the `documentation` branch.  

## Fixes
* `fix/unified-styling`
  * **Description**: Changes .css files for more cohesive and presentable website styling.
  * **Status**: N/A
  * **Remaining Work**: Review and merge into `main`.
* `fix/updating-pod-routes`
  * **Description**: Updated pod APIs and associated documentation.
  * **Status**: Pull request #38.
  * **Remaining Work**: Review pull request.
* `fix/user-test-only`
  * **Description**: Same as/very similar to `tests` branch.
  * **Status**: N/A
  * **Remaining Work**: Review this branch and `tests`.
* `fix/user_test_2`
  * **Description**: Contains `admin.js` which should be handled in its own branch, duplicate/similar user API tests as `tests` and `fix/user-test-only`, and API edits to pass tests.
  * **Status**: N/A 
  * **Remaining Work**: Review.

## Tests
* `tests`
  * **Description**: Contains unit tests for user APIs.
  * **Status**: N/A
  * **Remaining Work**: Review tests and add more if needed for user APIs.
* `user_tests_update`
  * **Description**: Contains API edits and additional unit tests.
  * **Status**: Was split up into two separate branches - see pull request #32.
  * **Remaining Work**: Delete after reviewing branch.

## Miscellaneous
* `documentation`
  * **Description**: Contains .md documentation for different features of the website.
  * **Status**: N/A
  * **Remaining Work**: Merge into `main`, keep as reference, or delete if it's information is not needed.
* `timesheets`
  * **Description**: Contains timesheets the capstone team had to submit for the Fall 2025 semester as per the course instructions.
  * **Status**: Left up for the TA's end-of-semester grading.
  * **Remaining Work**: Delete after the course is concluded.
* `staging`
  * **Description**: Combines `main` with `feature/ProfilePage_v2` to create a presentable website with profile implemented.
  * **Status**: Profile needs redesigning, testing, and refactoring.
  * **Remaining Work**: See `Documentation/future_updates.md` in the `documentation` branch, or use as reference to view website functionality and delete.