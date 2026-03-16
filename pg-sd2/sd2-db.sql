DROP TABLE IF EXISTS item_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  location VARCHAR(100),
  bio TEXT,
  member_since YEAR,
  rating DECIMAL(2,1) DEFAULT 0.0,
  PRIMARY KEY (id)
);

CREATE TABLE categories (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE items (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category_id INT NOT NULL,
  user_id INT NOT NULL,
  size VARCHAR(50),
  city VARCHAR(100),
  availability_status VARCHAR(50) DEFAULT 'Available',
  date_posted DATE,
  PRIMARY KEY (id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE tags (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE item_tags (
  item_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (item_id, tag_id),
  FOREIGN KEY (item_id) REFERENCES items(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);

INSERT INTO users (username, email, location, bio, member_since, rating)
VALUES
('Ankit', 'ankit@example.com', 'London', 'Interested in circular fashion and community exchange.', 2024, 4.5),
('Sara', 'sara@example.com', 'Croydon', 'I enjoy upcycling clothes and sharing useful items.', 2024, 4.7),
('Mina', 'mina@example.com', 'Brixton', 'I repair and alter clothes for reuse.', 2023, 4.3);

INSERT INTO categories (name)
VALUES
('Repair'),
('Upcycle'),
('Alterations');

INSERT INTO items (title, description, category_id, user_id, size, city, availability_status, date_posted)
VALUES
('Denim Jacket Repair', 'A denim jacket that needs stitching on the sleeve.', 1, 1, 'M', 'London', 'Available', '2025-04-20'),
('Upcycled Tote Bag', 'Handmade tote bag created from reused fabric.', 2, 2, 'One Size', 'Croydon', 'Available', '2025-04-21'),
('Black Dress Alteration', 'Dress available for hem and waist alteration exchange.', 3, 3, 'S', 'Brixton', 'Available', '2025-04-22');

INSERT INTO tags (name)
VALUES
('Denim'),
('Sustainable'),
('Handmade'),
('Alteration'),
('Repair');

INSERT INTO item_tags (item_id, tag_id)
VALUES
(1, 1),
(1, 5),
(2, 2),
(2, 3),
(3, 4);