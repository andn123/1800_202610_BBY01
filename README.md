# IntelliRoute

## Overview

IntelliRoute is a navigation app designed to help Vancouver residents and visitors have a better navigation experience during the World Cup which includes features current navigation apps lack, such as crowd visibility and improved usability. 

Our mission is to improve the navigation experience for both Vancouver residents and international visitors during large-scale events. We aim to reduce stress, save time, and improve safety by providing smarter, clearer, and more event-aware navigation tools.

Developed for the COMP 1800 course, this project applies User-Centred Design practices and agile project management, and demonstrates integration with Firebase backend services for storing user data.

---

## Features

- Browse a list of crowd reports with images of the location and crowd-level details
- Get directions to a destination and determine if that destination is crowded
- View previous location search history and personal crowd reports
- Responsive design for desktop and mobile

---

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Backend**: Firebase for hosting
- **Database**: Firestore

---

## Usage

To run the application locally:

1.  **Clone** the repository.
2.  **Install dependencies** by running `npm install` in the project root directory.
3.  **Start the development server** by running the command: `npm run dev`.
4.  Open your browser and visit the local address shown in your terminal (usually `http://localhost:5173` or similar).

---

## Project Structure

```
1800_202610_BBY01/
├── src/
│   ├── main.js
├── styles/
│   └── style.css
├── public/
├── images/
├── index.html
├── package.json
├── README.md
```

---

## Contributors

- **Naseem Ahmadzai**

- **Andrew Ni**

- **Kelly Bayingana**

---

## Acknowledgments

- Map data and images are for demonstration purposes only.
- Code snippets were adapted from resources such as [Stack Overflow](https://stackoverflow.com/) and [MDN Web Docs](https://developer.mozilla.org/).
- Icons sourced from [FontAwesome](https://fontawesome.com/) and images from [Unsplash](https://unsplash.com/).

---

## Limitations and Future Work

### Limitations

- Search results are less comprehensive than other navigation apps.
- Accessibility features can be further improved.

### Future Work

- Improve search coverage to match or exceed that of other navigation apps.
- Add features to validate crowdsourced data, such as a like/dislike system.
- Create a dark mode for better usability in low-light conditions.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.
