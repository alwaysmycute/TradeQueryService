#!/bin/bash

files="query-country-area-reference.js query-hscode-reference.js query-trade-monthly-by-code.js query-trade-monthly-by-countries.js query-trade-monthly-by-group.js"

for file in $files; do
  # Remove export const execute = async and the entire function
  # Keep everything else, including export async function handler
  
  awk '
  BEGIN { skip=0; depth=0 }
  
  # Start of execute function - skip until closing brace at depth 0
  /^export const execute = async/ || /^export async function execute/ {
    skip=1
    depth=1
    next
  }
  
  # Count braces to find end of function
  {
    if (skip) {
      gsub(/{/, "{+1")
      gsub(/}/, "{-1")
      
      if (depth == 0 && $0 ~ /^}/) {
        skip=0
        next
      }
    }
  }
  
  # Print lines we want to keep
  !skip { print }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  
  if [ $? -eq 0 ]; then
    echo "Fixed: $file"
  else
    echo "Failed: $file"
  fi
done

echo "Done!"

# Fix remaining files
files="query-trade-monthly-growth.js query-trade-monthly-growth-by-countries.js query-trade-monthly-share-by-countries.js query-trade-monthly-totals.js query-trade-transactions.js query-trade-yearly-by-countries.js query-trade-yearly-growth.js query-trade-yearly-share-by-countries.js query-trade-yearly-totals.js"

for file in $files; do
  echo "=== $file ==="
  
  awk '
  BEGIN { skip=0; depth=0 }
  
  # Start of execute function - skip until closing brace at depth 0
  /^export const execute = async/ || /^export async function execute/ {
    skip=1
    depth=1
    next
  }
  
  # Count braces to find end of function
  {
    if (skip) {
      gsub(/{/, "{+1")
      gsub(/}/, "{-1")
      
      if (depth == 0 && $0 ~ /^}/) {
        skip=0
        next
      }
    }
  }
  
  # Print lines we want to keep
  !skip { print }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  
  if [ $? -eq 0 ]; then
    echo "Fixed: $file"
  else
    echo "Failed: $file"
  fi
done

echo "All done!"
