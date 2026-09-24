UPDATE `campuses`
SET `name` = 'IMS Engineering College', `slug` = 'ims-engineering-college', `updated_at` = 1789891200000
WHERE `slug` IN ('st-xaviers', 'ims-engineering-college');

UPDATE `college_domains`
SET `domain` = 'imsec.ac.in'
WHERE `domain` IN ('xaviers.edu', 'imsengineeringcollege.edu');
