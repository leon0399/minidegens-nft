#! /bin/bash

shuffled=($(seq 0 $(basename $(ls -1v ./images | tail -1) .png) | shuf))

for n in "${!shuffled[@]}"; do
    mv "./images/${n}.png" "./images/${shuffled[n]}.png.tmp"
done

for file in images/*.tmp; do
    mv $file "${file%%.tmp}"
done
