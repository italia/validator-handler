"use strict";
import { ValidationError } from "jsonschema";

const arrayChunkify = async (
  inputArray: [],
  numberOfDesiredChuck: number,
  balanced = true
) => {
  if (numberOfDesiredChuck < 2) {
    return [inputArray];
  }

  const len = inputArray.length,
    out = [];
  let i = 0,
    size: number;

  if (len % numberOfDesiredChuck === 0) {
    size = Math.floor(len / numberOfDesiredChuck);
    while (i < len) {
      out.push(inputArray.slice(i, (i += size)));
    }
  } else if (balanced) {
    while (i < len) {
      size = Math.ceil((len - i) / numberOfDesiredChuck--);
      out.push(inputArray.slice(i, (i += size)));
    }
  } else {
    numberOfDesiredChuck--;
    size = Math.floor(len / numberOfDesiredChuck);
    if (len % size === 0) size--;
    while (i < size * numberOfDesiredChuck) {
      out.push(inputArray.slice(i, (i += size)));
    }
    out.push(inputArray.slice(size * numberOfDesiredChuck));
  }

  return out;
};

const mapValidationErrors = async (
  validationErrors: ValidationError[]
): Promise<string> => {
  const errorMessages = [];

  for (const element of validationErrors) {
    errorMessages.push(element.stack);
  }

  return errorMessages.join(" | ");
};

export { arrayChunkify, mapValidationErrors };
