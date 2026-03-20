// Circular Fashion Frontend JavaScript

document.addEventListener("DOMContentLoaded", function () {

    console.log("Circular Fashion site loaded");

    // 1. Smooth scrolling for navigation links
    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach(link => {
        link.addEventListener("click", function (e) {
            const targetId = this.getAttribute("href");
            const targetSection = document.querySelector(targetId);

            if (targetSection) {
                e.preventDefault();
                targetSection.scrollIntoView({
                    behavior: "smooth"
                });
            }
        });
    });

    // 2. Sticky header on scroll
    const header = document.querySelector(".site-header");

    if (header) {
        window.addEventListener("scroll", function () {
            if (window.scrollY > 50) {
                header.classList.add("sticky");
            } else {
                header.classList.remove("sticky");
            }
        });
    }

    // 3. Highlight active nav link on scroll (YOUR FEATURE)
    const sections = document.querySelectorAll("section");
    const navLinks = document.querySelectorAll(".nav a");

    window.addEventListener("scroll", () => {
        let current = "";

        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.offsetHeight;

            if (window.pageYOffset >= sectionTop && window.pageYOffset < sectionTop + sectionHeight) {
                current = section.getAttribute("id");
            }
        });

        navLinks.forEach(link => {
            link.classList.remove("active");
            if (link.getAttribute("href") === `#${current}`) {
                link.classList.add("active");
            }
        });
    });

    // 4. Button interaction
    const buttons = document.querySelectorAll(".btn.primary");

    buttons.forEach(button => {
        button.addEventListener("click", function () {
            alert("Thank you for supporting Circular Fashion!");
        });
    });

    // 5. Example: Fetch message from server (optional)
    fetch("/api/message")
        .then(response => response.json())
        .then(data => {
            console.log("Server message:", data.message);
        })
        .catch(err => {
            console.log("Server not available");
        });

});