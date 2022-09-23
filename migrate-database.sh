#!/bin/bash

PRJPATH=$1
PRJPATH=${PRJPATH:-$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )}

read -p "Enter distribution type (typescript|javascript) [typescript]: " DISTRIBUTION_TYPE
DISTRIBUTION_TYPE=${DISTRIBUTION_TYPE:-typescript}
if [[ "$DISTRIBUTION_TYPE" != "typescript" && "$DISTRIBUTION_TYPE" != "javascript" ]]; then
   echo "Invalid distribution type"
   exit
fi

INITIALCOMMAND=''
if [[ "$DISTRIBUTION_TYPE" == "typescript" ]]; then
  INITIALCOMMAND='node --experimental-modules --es-module-specifier-resolution=node --loader ts-node/esm ./database/migrate.ts --tablename '
elif [[ "$DISTRIBUTION_TYPE" == "javascript" ]]; then
  INITIALCOMMAND='node --experimental-modules --es-module-specifier-resolution=node ./database/migrate.js --tablename '
fi

TABLENAME=''
read -p "Enter table to deploy (all|entity|job|user|token): " TABLE
if [[ "$TABLE" != "all" && "$TABLE" != "entity" && "$TABLE" != "job" && "$TABLE" != "user" && "$TABLE" != "token" ]]; then
   echo "Invalid table"
   exit
fi

case $TABLE in

  entity)
    TABLENAME='entity'
    ;;

  job)
    TABLENAME='job'
    ;;

  user)
    TABLENAME='user'
    ;;

  token)
    TABLENAME='token'
    ;;

  all)
    TABLENAME='all'
    ;;

  *)
    echo -n "Invalid table"
    exit
    ;;

esac

COMMAND="$INITIALCOMMAND$TABLENAME"

if [[ "$DISTRIBUTION_TYPE" == "typescript" ]]; then
  (cd "$PRJPATH" && eval "$COMMAND")
elif [[ "$DISTRIBUTION_TYPE" == "javascript" ]]; then
  (cd "$PRJPATH"/dist && eval "$COMMAND")
fi