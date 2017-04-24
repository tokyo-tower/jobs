cd /d %~dp0
cd ../
set NODE_ENV=development
node bin/command schema dropCollections

node bin/command film createTicketTypeGroupsFromJson
node bin/command film createFromJson
node bin/command theater createFromJson
node bin/command theater createScreensFromJson
node bin/command performance createFromJson

node bin/command member createFromJson
node bin/command staff createFromJson
node bin/command window createFromJson

node bin/command staff createReservationsFromJson
node bin/command member createReservationsFromJson

pause