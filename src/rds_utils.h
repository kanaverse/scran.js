#ifndef RDS_UTILS_H
#define RDS_UTILS_H

#include <emscripten.h>
#include "rds2cpp/rds2cpp.hpp"

class RdsObject {
public:
    RdsObject(const rds2cpp::RObject* p) : ptr(p) {}

    std::string type() const {
        switch (ptr->type()) {
            case rds2cpp::SEXPType::INT:
                return "integer";
            case rds2cpp::SEXPType::REAL:
                return "double";
            case rds2cpp::SEXPType::STR:
                return "string";
            case rds2cpp::SEXPType::LGL:
                return "boolean";
            case rds2cpp::SEXPType::VEC:
                return "vector";
            case rds2cpp::SEXPType::S4:
                return "S4";
            case rds2cpp::SEXPType::NIL:
                return "null";
            default:
                break;
        }
        return "other";
    }

private:
    template<class Vector>
    int32_t size_() const {
        auto xptr = static_cast<const Vector*>(ptr);
        return xptr->data.size();
    }

public:
    int32_t size() const {
        switch (ptr->type()) {
            case rds2cpp::SEXPType::INT:
                return size_<rds2cpp::IntegerVector>();
            case rds2cpp::SEXPType::REAL:
                return size_<rds2cpp::DoubleVector>();
            case rds2cpp::SEXPType::STR:
                return size_<rds2cpp::StringVector>();
            case rds2cpp::SEXPType::LGL:
                return size_<rds2cpp::LogicalVector>();
            case rds2cpp::SEXPType::VEC:
                return size_<rds2cpp::GenericVector>();
            default:
                break;
        }
        return -1;
    }

private:
    template<class Vector>
    emscripten::val numeric_vector_() const {
        auto xptr = static_cast<const Vector*>(ptr);
        return emscripten::val(emscripten::typed_memory_view(xptr->data.size(), xptr->data.data()));
    }

public:
    emscripten::val numeric_vector() const {
        switch (ptr->type()) {
            case rds2cpp::SEXPType::INT:
                return numeric_vector_<rds2cpp::IntegerVector>();
            case rds2cpp::SEXPType::REAL:
                return numeric_vector_<rds2cpp::DoubleVector>();
            case rds2cpp::SEXPType::LGL:
                return numeric_vector_<rds2cpp::LogicalVector>();
            default:
                break;
        }
        throw std::runtime_error("cannot obtain numeric values for non-numeric RObject type");
        return numeric_vector_<rds2cpp::IntegerVector>(); // avoid compiler warning.
    }

private:
    static emscripten::val extract_strings(const std::vector<std::string>& values) {
        auto output = emscripten::val::array(); 
        for (const auto& s : values) {
            output.call<void>("push", emscripten::val(s));
        }
        return output;
    }

public:
    emscripten::val string_vector() {
        if (ptr->type() != rds2cpp::SEXPType::STR) {
            throw std::runtime_error("cannot return string values for non-string RObject type");
        }
        auto sptr = static_cast<const rds2cpp::StringVector*>(ptr);
        return extract_strings(sptr->data);
    }

private:
    std::vector<char> attribute_names_buffer_;
    std::vector<int32_t> attribute_names_lengths_;

    template<class AttrClass>
    emscripten::val extract_attribute_names() {
        auto aptr = static_cast<const AttrClass*>(ptr);
        return extract_strings(aptr->attributes.names);
    }

public:
    emscripten::val attribute_names() {
        switch (ptr->type()) {
            case rds2cpp::SEXPType::INT:
                return extract_attribute_names<rds2cpp::IntegerVector>();
            case rds2cpp::SEXPType::REAL:
                return extract_attribute_names<rds2cpp::DoubleVector>();
            case rds2cpp::SEXPType::LGL:
                return extract_attribute_names<rds2cpp::LogicalVector>();
            case rds2cpp::SEXPType::STR:
                return extract_attribute_names<rds2cpp::StringVector>();
            case rds2cpp::SEXPType::VEC:
                return extract_attribute_names<rds2cpp::GenericVector>();
            case rds2cpp::SEXPType::S4:
                return extract_attribute_names<rds2cpp::S4Object>();
            default:
                return emscripten::val::array();
        }
    }

private:
    template<class AttrClass>
    int32_t find_attribute_(const std::string& name) const {
        auto aptr = static_cast<const AttrClass*>(ptr);
        const auto& attr_names = aptr->attributes.names;

        for (size_t i = 0; i < attr_names.size(); ++i) {
            if (attr_names[i] == name) {
                return i;                                
            }
        }

        return -1;
    }

public:
    int32_t find_attribute(std::string name) const {
        switch (ptr->type()) {
            case rds2cpp::SEXPType::INT:
                return find_attribute_<rds2cpp::IntegerVector>(name);
            case rds2cpp::SEXPType::REAL:
                return find_attribute_<rds2cpp::DoubleVector>(name);
            case rds2cpp::SEXPType::LGL:
                return find_attribute_<rds2cpp::LogicalVector>(name);
            case rds2cpp::SEXPType::STR:
                return find_attribute_<rds2cpp::StringVector>(name);
            case rds2cpp::SEXPType::VEC:
                return find_attribute_<rds2cpp::GenericVector>(name);
            case rds2cpp::SEXPType::S4:
                return find_attribute_<rds2cpp::S4Object>(name);
            default:
                break;
        }
        return -1;
    }

private:
    template<class AttrClass>
    RdsObject load_attribute_(int32_t i) const {
        auto aptr = static_cast<const AttrClass*>(ptr);
        if (static_cast<size_t>(i) >= aptr->attributes.values.size()) {
            throw std::runtime_error("requested attribute index " + std::to_string(i) + " is out of range");
        }
        const auto& chosen = aptr->attributes.values[i];
        return RdsObject(chosen.get());
    }

public:
    RdsObject load_attribute_by_index(int32_t i) const {
        switch (ptr->type()) {
            case rds2cpp::SEXPType::INT:
                return load_attribute_<rds2cpp::IntegerVector>(i);
            case rds2cpp::SEXPType::REAL:
                return load_attribute_<rds2cpp::IntegerVector>(i);
            case rds2cpp::SEXPType::LGL:
                return load_attribute_<rds2cpp::LogicalVector>(i);
            case rds2cpp::SEXPType::STR:
                return load_attribute_<rds2cpp::StringVector>(i);
            case rds2cpp::SEXPType::VEC:
                return load_attribute_<rds2cpp::GenericVector>(i);
            case rds2cpp::SEXPType::S4:
                return load_attribute_<rds2cpp::S4Object>(i);
            default:
                break;
        }

        throw std::runtime_error("unsupported R object type");
        return load_attribute_<rds2cpp::S4Object>(i); // avoid compiler warnings.
    }

    RdsObject load_attribute_by_name(std::string n) const {
        int32_t i = find_attribute(n);
        if (i < 0) {
            throw std::runtime_error("no attribute named '" + n + "'");
        }
        return load_attribute_by_index(i);
    }

public:
    RdsObject load_list_element(int32_t i) const {
        if (ptr->type() != rds2cpp::SEXPType::VEC) {
            throw std::runtime_error("cannot return list element for non-list R object");
        }
        auto lptr = static_cast<const rds2cpp::GenericVector*>(ptr);
        return RdsObject(lptr->data[i].get());
    }

public:
    std::string class_name() const {
        if (ptr->type() != rds2cpp::SEXPType::S4) {
            throw std::runtime_error("cannot return class name for non-S4 R object");
        }
        auto sptr = static_cast<const rds2cpp::S4Object*>(ptr);
        return sptr->class_name;
    }

    std::string package_name() const {
        if (ptr->type() != rds2cpp::SEXPType::S4) {
            throw std::runtime_error("cannot return class name for non-S4 R object");
        }
        auto sptr = static_cast<const rds2cpp::S4Object*>(ptr);
        return sptr->package_name;
    }

public:
    const rds2cpp::RObject* ptr;
};

#endif
