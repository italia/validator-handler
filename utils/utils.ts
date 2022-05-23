'use strict'

const arrayChunkify = async (inputArray: [], numberOfDesiredChuck: number, balanced: boolean = true) => {
    if (numberOfDesiredChuck < 2) {
        return [inputArray]
    }

    let len = inputArray.length,
        out = [],
        i = 0,
        size

    if (len % numberOfDesiredChuck === 0) {
        size = Math.floor(len / numberOfDesiredChuck)
        while (i < len) {
            out.push(inputArray.slice(i, i += size))
        }
    } else if (balanced) {
        while (i < len) {
            size = Math.ceil((len - i) / numberOfDesiredChuck--)
            out.push(inputArray.slice(i, i += size))
        }
    } else {
        numberOfDesiredChuck--
        size = Math.floor(len / numberOfDesiredChuck)
        if (len % size === 0)
            size--
        while (i < size * numberOfDesiredChuck) {
            out.push(inputArray.slice(i, i += size))
        }
        out.push(inputArray.slice(size * numberOfDesiredChuck))
    }

    return out
}

export { arrayChunkify }