const calculateAge = (dob) => {
  const birthDate = new Date(dob);
  const currentDate = new Date();

  // Calculate difference in milliseconds between current date and birthdate
  const ageInMillis = currentDate - birthDate;

  // Convert milliseconds to years
  const ageInYears = ageInMillis / (1000 * 60 * 60 * 24 * 365.25);

  // Round down the age to get the whole number of years
  const age = Math.floor(ageInYears);

  return age;
};

module.exports = { calculateAge };
